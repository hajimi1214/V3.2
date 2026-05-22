import argparse
import uvicorn

parser = argparse.ArgumentParser(description="智领铜行--人工智能机械臂多Agent智能决策平台 V3.2")
parser.add_argument("--host", default="0.0.0.0")
parser.add_argument("--port", type=int, default=7860)
parser.add_argument("--reload", action="store_true")
args = parser.parse_args()

uvicorn.run("server:app", host=args.host, port=args.port, reload=args.reload)
