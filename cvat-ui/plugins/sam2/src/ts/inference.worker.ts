// Copyright (C) 2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { InferenceSession, env, Tensor } from 'onnxruntime-web';

let decoder: InferenceSession | null = null;

env.wasm.wasmPaths = '/assets/';

export enum WorkerAction {
    INIT = 'init',
    DECODE = 'decode',
}

export interface InitBody {
    decoderURL: string;
}

export interface RawTensor {
    dims: readonly number[];
    type: string;
    data: any; // TypedArray
}

export interface DecodeBody {
    image_embed: RawTensor;
    high_res_feats_0: RawTensor;
    high_res_feats_1: RawTensor;
    point_coords: RawTensor;
    point_labels: RawTensor;
    orig_im_size: RawTensor;
    mask_input: RawTensor;
    has_mask_input: RawTensor;
}

export interface WorkerOutput {
    action: WorkerAction;
    error?: string;
}

export interface WorkerInput {
    action: WorkerAction;
    payload: InitBody | DecodeBody;
}

const errorToMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }

    console.error(error);
    return 'Unknown error, please check console';
};

// eslint-disable-next-line no-restricted-globals
if ((self as any).importScripts) {
    onmessage = (e: MessageEvent<WorkerInput>) => {
        if (e.data.action === WorkerAction.INIT) {
            if (decoder) {
                return;
            }

            const body = e.data.payload as InitBody;
            InferenceSession.create(body.decoderURL, { logSeverityLevel: 0 }).then((decoderSession) => {
                decoder = decoderSession;
                postMessage({ action: WorkerAction.INIT });
            }).catch((error: unknown) => {
                postMessage({ action: WorkerAction.INIT, error: errorToMessage(error) });
            });
        } else if (!decoder) {
            postMessage({
                action: e.data.action,
                error: 'Worker was not initialized',
            });
        } else if (e.data.action === WorkerAction.DECODE) {
            const raw = e.data.payload as DecodeBody;
            
            try {
                const createTensor = (rawTensor: RawTensor) => {
                    return new Tensor(rawTensor.type as any, rawTensor.data, rawTensor.dims);
                };

                const payload: Record<string, Tensor> = {
                    image_embed: createTensor(raw.image_embed),
                    high_res_feats_0: createTensor(raw.high_res_feats_0),
                    high_res_feats_1: createTensor(raw.high_res_feats_1),
                    point_coords: createTensor(raw.point_coords),
                    point_labels: createTensor(raw.point_labels),
                    orig_im_size: createTensor(raw.orig_im_size),
                    mask_input: createTensor(raw.mask_input),
                    has_mask_input: createTensor(raw.has_mask_input),
                };

                console.log("[SAM2 Worker] Tensors reconstructed successfully");

                decoder.run(payload).then((results: any) => {
                    postMessage({
                        action: WorkerAction.DECODE,
                        payload: {
                            masks: {
                                data: results.masks.data,
                                dims: results.masks.dims,
                                type: results.masks.type
                            },
                            lowResMasks: {
                                data: results.low_res_masks.data,
                                dims: results.low_res_masks.dims,
                                type: results.low_res_masks.type
                            },
                            xtl: Number(results.xtl.data[0]),
                            ytl: Number(results.ytl.data[0]),
                            xbr: Number(results.xbr.data[0]),
                            ybr: Number(results.ybr.data[0]),
                        },
                    });
                }).catch((error: unknown) => {
                    postMessage({ action: WorkerAction.DECODE, error: errorToMessage(error) });
                });
            } catch (e) {
                console.error("[SAM2 Worker] Error recreating tensors:", e);
                postMessage({ action: WorkerAction.DECODE, error: errorToMessage(e) });
            }
        }
    };
}
