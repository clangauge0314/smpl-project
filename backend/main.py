import os
import torch
import smplx
import numpy as np
import uvicorn
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import traceback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

MODEL_FILE_NAME = "SMPL_NEUTRAL2.pkl"
MODEL_PATH = os.path.join(os.path.dirname(__file__), MODEL_FILE_NAME)

smpl_model = None

def load_smpl_model(model_path, gender='neutral', batch_size=1):
    if not os.path.exists(model_path):
        print(f"오류: SMPL 모델 파일이 지정된 경로에 없습니다: {model_path}")
        print("모델 파일을 다운로드하여 올바른 위치에 두세요.")
        return None

    try:
        print(f"SMPL 모델 로드 시도 중... 경로: {model_path}, 타입: 'smpl'")
        model = smplx.create(
            model_path=model_path,
            model_type='smpl',
            gender=gender,
            batch_size=batch_size,
            create_body_pose=True,
            create_betas=True,
            create_transl=True
        )
        print(f"SMPL 모델을 성공적으로 불러왔습니다. (gender: {gender})")
        return model
    except Exception as e:
        print(f"SMPL 모델을 불러오는 중 오류가 발생했습니다: {e}")
        print(f"오류 상세: {traceback.format_exc()}")
        print("smplx 라이브러리가 설치되었는지, PyTorch 또는 TensorFlow 백엔드가 설치되었는지, 모델 파일이 손상되지 않았는지 확인하세요.")
        print("특히 smplx.create의 model_type ('smpl')이 이 파일과 호환되는지 확인이 필요할 수 있습니다.")
        return None

def calculate_approximate_measurements(height_cm: float, weight_kg: float):
    if height_cm <= 0 or weight_kg <= 0:
        return {"chest": 0, "waist": 0, "hips": 0, "inseam": 0, "bmi": 0}

    height_m = height_cm / 100.0
    bmi = weight_kg / (height_m ** 2)

    base_height_cm = 170.0
    base_bmi = 22.0

    ref_chest = 90.0
    ref_waist = 75.0
    ref_hips = 90.0
    ref_inseam = 78.0

    height_scale = height_cm / base_height_cm

    bmi_deviation_factor = (bmi - base_bmi) / base_bmi

    bmi_influence_chest = 0.6
    bmi_influence_waist = 1.5
    bmi_influence_hips = 0.8
    bmi_influence_inseam = 0.1

    chest = ref_chest * height_scale * (1 + bmi_deviation_factor * bmi_influence_chest)
    waist = ref_waist * height_scale * (1 + bmi_deviation_factor * bmi_influence_waist)
    hips = ref_hips * height_scale * (1 + bmi_deviation_factor * bmi_influence_hips)

    inseam_ratio_at_base_height = ref_inseam / base_height_cm
    inseam = height_cm * (inseam_ratio_at_base_height + (height_cm - base_height_cm) * 0.0002)
    inseam = inseam * (1 + bmi_deviation_factor * bmi_influence_inseam)

    chest = max(60.0, min(150.0, chest))
    waist = max(50.0, min(140.0, waist))
    hips = max(60.0, min(160.0, hips))
    inseam = max(40.0, min(height_cm * 0.6, inseam))

    return {
        "chest": round(chest, 1),
        "waist": round(waist, 1),
        "hips": round(hips, 1),
        "inseam": round(inseam, 1),
        "bmi": round(bmi, 1)
    }

def calculate_predicted_measurements(height, weight):
    """키와 몸무게로부터 다른 신체 치수를 예측"""
    # BMI 계산
    bmi = weight / ((height/100) ** 2)
    
    # 표준 BMI 범위 (18.5-24.9)에서의 조정 계수
    # 정상 BMI 중간값(21.7)을 기준으로 설정
    bmi_factor = (bmi / 21.7)
    
    # 기본 비율 (표준 체형 기준)
    # 남성 평균 비율: 가슴 = 키의 0.52, 허리 = 키의 0.45, 엉덩이 = 키의 0.51, 인심 = 키의 0.45
    base_chest = height * 0.52
    base_waist = height * 0.45
    base_hips = height * 0.51
    base_inseam = height * 0.45
    
    # BMI에 따른 조정
    # 허리: BMI에 가장 민감하게 반응 (지방이 가장 먼저 쌓이는 부위)
    waist = base_waist * bmi_factor
    
    # 가슴: BMI가 높을수록 증가하지만 허리보다는 덜 민감
    chest = base_chest * (0.7 + 0.3 * bmi_factor)
    
    # 엉덩이: BMI에 따라 증가하지만 허리보다 훨씬 덜 민감
    hips = base_hips * (0.8 + 0.2 * bmi_factor)
    
    # 인심: 키에 비례하며 BMI의 영향이 적음 (다리 길이는 체중과 큰 관계 없음)
    inseam = base_inseam * (1.05 - 0.05 * bmi_factor)
    
    # 극단적인 BMI 값에 대한 추가 보정
    if bmi > 30:  # 고도 비만
        excess = (bmi - 30) / 10
        waist += base_waist * excess * 0.25  # 허리에 가장 큰 영향
        chest += base_chest * excess * 0.15
        hips += base_hips * excess * 0.1     # 엉덩이는 상대적으로 적은 영향
    
    if bmi < 18.5:  # 저체중
        # 저체중일 때는 모든 둘레가 더 작아지도록 조정
        deficit = (18.5 - bmi) / 18.5
        waist = waist * (1 - deficit * 0.2)
        chest = chest * (1 - deficit * 0.15)
        hips = hips * (1 - deficit * 0.1)
    
    return {
        "chest": round(chest, 1),
        "waist": round(waist, 1),
        "hips": round(hips, 1),
        "inseam": round(inseam, 1)
    }

class SMPLGenerateRequest(BaseModel):
    height: float = Field(..., description="사용자 키 (미터)")
    weight: float = Field(..., description="사용자 몸무게 (킬로그램)")
    betas: List[float] = Field([0.0] * 10, description="SMPL 베타 파라미터 (10개의 float 값, 일반적으로 -3에서 3 사이)", min_items=10, max_items=10)

class PredictMeasurementsRequest(BaseModel):
    height: float = Field(..., description="사용자 키 (cm)")
    weight: float = Field(..., description="사용자 몸무게 (kg)")

class GenerateAvatarRequest(BaseModel):
    height: float = Field(..., description="사용자 키 (cm)")
    weight: float = Field(..., description="사용자 몸무게 (kg)")
    chest: Optional[float] = Field(None, description="가슴 둘레 (cm)")
    waist: Optional[float] = Field(None, description="허리 둘레 (cm)")
    hips: Optional[float] = Field(None, description="엉덩이 둘레 (cm)")
    inseam: Optional[float] = Field(None, description="인심 길이 (cm)")

class AdjustMeasurementsRequest(BaseModel):
    height: float = Field(..., description="사용자 키 (cm)")
    weight: float = Field(..., description="사용자 몸무게 (kg)")
    changed_param: str = Field(..., description="변경된 파라미터 이름")
    changed_value: float = Field(..., description="변경된 파라미터 값")

@app.on_event("startup")
async def startup_event():
    global smpl_model
    smpl_model = load_smpl_model(MODEL_PATH)
    if smpl_model is None:
        pass

@app.get("/")
async def read_root():
    return {
        "message": "FastAPI SMPL backend is running.",
        "model_loaded": smpl_model is not None,
        "model_path_checked": os.path.exists(MODEL_PATH)
    }

@app.post("/generate_smpl/")
async def generate_smpl(params: SMPLGenerateRequest):
    if smpl_model is None:
        raise HTTPException(status_code=500, detail="SMPL 모델이 서버 시작 시 로드되지 않았습니다. 백엔드 로그를 확인하세요.")

    try:
        height_cm = params.height * 100.0

        calculated_measurements = calculate_approximate_measurements(height_cm, params.weight)

        betas_list = params.betas
        betas_tensor = torch.tensor(betas_list, dtype=torch.float32).unsqueeze(0)

        expected_beta_dims = smpl_model.num_betas if hasattr(smpl_model, 'num_betas') else 10
        if betas_tensor.shape[1] != expected_beta_dims:
             print(f"경고: 베타 텐서 차원 불일치. 예상: {expected_beta_dims}, 실제: {betas_tensor.shape[1]}. SMPL 모델이 예상하는 차원에 맞게 조정되지 않을 수 있습니다.")

        global_orient_tensor = torch.zeros([1, 3], dtype=torch.float32)
        body_pose_tensor = torch.zeros([1, 69], dtype=torch.float32)

        output = smpl_model(
            betas=betas_tensor,
            global_orient=global_orient_tensor,
            body_pose=body_pose_tensor,
            return_verts=True
        )

        vertices = output.vertices.detach().cpu().numpy().squeeze()

        faces = smpl_model.faces

        vertices_list = vertices.flatten().tolist()
        faces_list = faces.flatten().tolist()

        return {
            "vertices": vertices_list,
            "faces": faces_list,
            "num_vertices": vertices.shape[0],
            "num_faces": faces.shape[0],
            "calculated_measurements": calculated_measurements
        }

    except Exception as e:
        print(f"SMPL 메시 생성 중 오류 발생: {e}")
        print(f"오류 상세: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"SMPL 메시 생성 중 오류 발생: {e}")

@app.post("/predict-measurements/")
async def predict_measurements(request: PredictMeasurementsRequest):
    """키와 몸무게를 기반으로 신체 치수를 예측합니다."""
    try:
        measurements = calculate_predicted_measurements(request.height, request.weight)
        return measurements
    except Exception as e:
        print(f"측정값 예측 중 오류 발생: {e}")
        print(f"오류 상세: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"측정값 예측 중 오류 발생: {e}")

@app.post("/generate-avatar/")
async def generate_avatar(request: GenerateAvatarRequest):
    """사용자 신체 치수를 기반으로 아바타를 생성합니다."""
    if smpl_model is None:
        raise HTTPException(status_code=500, detail="SMPL 모델이 로드되지 않았습니다.")
    
    try:
        # 측정값 계산 또는 사용자 입력값 사용
        measurements = calculate_predicted_measurements(request.height, request.weight)
        
        # 사용자가 제공한 값이 있으면 해당 값으로 대체
        if request.chest is not None and request.chest > 0:
            measurements["chest"] = request.chest
        if request.waist is not None and request.waist > 0:
            measurements["waist"] = request.waist
        if request.hips is not None and request.hips > 0:
            measurements["hips"] = request.hips
        if request.inseam is not None and request.inseam > 0:
            measurements["inseam"] = request.inseam
        
        # 측정값을 SMPL 베타 파라미터로 변환 (간단한 매핑)
        betas = [0.0] * 10
        
        # 키와 몸무게를 베타 파라미터에 반영 (간단한 예시)
        height_norm = (request.height - 170) / 20  # 170cm를 기준으로 정규화
        weight_norm = (request.weight - 70) / 20   # 70kg을 기준으로 정규화
        
        # 첫 번째 베타 파라미터는 주로 전체 크기에 영향
        betas[0] = height_norm
        # 두 번째 베타 파라미터는 주로 체중에 영향
        betas[1] = weight_norm
        
        # 가슴, 허리, 엉덩이 치수를 다른 베타 파라미터에 반영
        chest_norm = (measurements["chest"] - 90) / 15
        waist_norm = (measurements["waist"] - 80) / 15
        hips_norm = (measurements["hips"] - 90) / 15
        
        betas[2] = waist_norm  # 허리 둘레
        betas[3] = chest_norm  # 가슴 둘레
        betas[4] = hips_norm   # 엉덩이 둘레
        
        # SMPL 모델 실행
        betas_tensor = torch.tensor(betas, dtype=torch.float32).unsqueeze(0)
        global_orient_tensor = torch.zeros([1, 3], dtype=torch.float32)
        body_pose_tensor = torch.zeros([1, 69], dtype=torch.float32)
        
        output = smpl_model(
            betas=betas_tensor,
            global_orient=global_orient_tensor,
            body_pose=body_pose_tensor,
            return_verts=True
        )
        
        vertices = output.vertices.detach().cpu().numpy().squeeze()
        faces = smpl_model.faces
        
        # 3D 메시 데이터 변환
        vertices_list = vertices.tolist()
        faces_list = faces.tolist()
        
        return {
            "vertices": vertices_list,
            "faces": faces_list,
            "measurements": measurements
        }
        
    except Exception as e:
        print(f"아바타 생성 중 오류 발생: {e}")
        print(f"오류 상세: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"아바타 생성 중 오류 발생: {e}")

@app.post("/adjust-measurements/")
async def adjust_measurements(request: AdjustMeasurementsRequest):
    """한 측정값이 변경되었을 때 다른 측정값들을 조정합니다."""
    try:
        # 기본 측정값 계산
        base_measurements = calculate_predicted_measurements(request.height, request.weight)
        
        # 변경된 파라미터 적용
        if request.changed_param == "chest":
            base_measurements["chest"] = request.changed_value
        elif request.changed_param == "waist":
            base_measurements["waist"] = request.changed_value
        elif request.changed_param == "hips":
            base_measurements["hips"] = request.changed_value
        elif request.changed_param == "inseam":
            base_measurements["inseam"] = request.changed_value
        
        return base_measurements
    except Exception as e:
        print(f"측정값 조정 중 오류 발생: {e}")
        print(f"오류 상세: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"측정값 조정 중 오류 발생: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)