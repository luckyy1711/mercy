# v1 model snapshot

To avoid duplicating hundreds of megabytes in GitHub Pages, this folder describes v1's model assets rather than copying them.

The exact, recoverable v1 snapshot—including model weights, tokenizers, manifests and licenses—is available in [archive/v1.0](https://github.com/luckyy1711/mercy/tree/archive/v1.0/models/onnx-community).

| Model | Hosted weight bytes at v1 | Parts | Path in complete archive |
| --- | ---: | ---: | --- |
| SmolLM2-135M-Instruct-ONNX | 135,658,354 | 3 | `models/onnx-community/SmolLM2-135M-Instruct-ONNX/` |
| SmolLM2-360M-Instruct-ONNX | 363,115,149 | 7 | `models/onnx-community/SmolLM2-360M-Instruct-ONNX/` |

The active website obtains model files from the **root `models/` directory**. The copied `v1/` scripts are historical source files, not a separate standalone deployment.

In the future, keep new large weight files in a single shared model store or attach them to an archival release rather than duplicating them in every version folder.
