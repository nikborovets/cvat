from cvat.settings.production import *  # noqa: F403,F401
import os

# Overlay for self-hosted deployments behind reverse proxy.
# Keep both schemes to avoid origin mismatches during proxy/HTTPS transitions.
_cvat_host = os.getenv("CVAT_HOST", "localhost")
CSRF_TRUSTED_ORIGINS = [
    f"https://{_cvat_host}",
    f"http://{_cvat_host}",
]

# # ASGI/uvicorn compatibility: nginx sendfile backend sets Content-Length
# # but delegates body transfer to X-Accel-Redirect, which can trigger
# # "Response content shorter than Content-Length" in uvicorn.
# SENDFILE_BACKEND = "django_sendfile.backends.development"
