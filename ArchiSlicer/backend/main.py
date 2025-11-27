from typing import Union
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse
import cv2
import numpy as np

app = FastAPI()

@app.get("/")
def read_root():
    print("Hello World")
    return {"Hello": "World"}

@app.post("/process_image/")
async def process_image(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    ret, buf = cv2.imencode('.png', edges)
    headers = {'Content-Disposition': 'inline; filename="edge.png"'}
    return StreamingResponse(iter([buf.tobytes()]), media_type="image/png", headers=headers)
