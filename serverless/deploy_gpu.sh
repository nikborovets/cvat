#!/bin/bash
# Sample commands to deploy nuclio functions on GPU

set -eu

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
FUNCTIONS_DIR=${1:-$SCRIPT_DIR}

nuctl create project cvat --platform local

shopt -s globstar

for func_config in "$FUNCTIONS_DIR"/**/function-gpu.yaml
do
    func_root="$(dirname "$func_config")"
    func_rel_path="$(realpath --relative-to="$SCRIPT_DIR" "$(dirname "$func_root")")"

    echo "Deploying $func_rel_path function..."
    nuctl deploy --project-name cvat --path "$func_root" --verbose \
        --file "$func_config" --platform local \
        --env CVAT_FUNCTIONS_REDIS_HOST=cvat_redis_ondisk \
        --env CVAT_FUNCTIONS_REDIS_PORT=6666 \
        --env http_proxy=socks5h://172.17.0.1:32448 \
        --env https_proxy=socks5h://172.17.0.1:32448 \
        --env HTTP_PROXY=socks5h://172.17.0.1:32448 \
        --env HTTPS_PROXY=socks5h://172.17.0.1:32448 \
        --platform-config '{"attributes": {"network": "borovets_cvat_cvat"}}'
done

nuctl get function --platform local
