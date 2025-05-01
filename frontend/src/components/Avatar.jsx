import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import axios from 'axios';

function AvatarMesh({ vertices, faces }) {
  const meshRef = useRef();
  const skinColor = "#E0AC8F";

  useEffect(() => {
    if (meshRef.current && meshRef.current.geometry) {
      meshRef.current.geometry.computeVertexNormals();
      meshRef.current.geometry.computeBoundingSphere();
      meshRef.current.geometry.computeBoundingBox();
    }
  }, [vertices, faces]);

  if (!vertices || vertices.length === 0 || !faces || faces.length === 0) {
      console.warn("AvatarMesh received empty or invalid vertices or faces data.");
      return null; 
  }

  const flatVertices = new Float32Array(vertices.flat());
  const flatFaces = new Uint16Array(faces.flat());

  if (flatVertices.length / 3 !== vertices.length) {
       console.error("Vertex data structure is unexpected. Expected array of [x, y, z].");
       return null;
  }
   if (flatFaces.length !== faces.flat().length) {
        console.error("Face data structure is unexpected. Expected array of [v1, v2, v3].");
        return null;
   }

  return (
    <group>
      <mesh ref={meshRef} rotation={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={flatVertices.length / 3}
            array={flatVertices}
            itemSize={3}
          />
          <bufferAttribute
            attach="index"
            array={flatFaces}
            count={flatFaces.length}
            itemSize={1}
          />
        </bufferGeometry>
        
        <meshPhysicalMaterial 
          color={skinColor}
          roughness={0.5}
          metalness={0.0}
          clearcoat={0.1}
          clearcoatRoughness={0.2}
          transmission={0.05}
          transparent={true}
          opacity={0.98}
          envMapIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

function adjustColor(color, amount) {
  try {
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];

    const num = parseInt(hex, 16);
    if (isNaN(num)) return color;

    let r = (num >> 16) + amount;
    let b = ((num >> 8) & 0x00FF) + amount;
    let g = (num & 0x0000FF) + amount;

    r = Math.max(0, Math.min(255, r));
    b = Math.max(0, Math.min(255, b));
    g = Math.max(0, Math.min(255, g));

    return `#${(g | (b << 8) | (r << 16)).toString(16).padStart(6, '0')}`;
  } catch (e) {
    console.error('색상 조정 중 오류 발생:', e);
    return color;
  }
}

export default function Avatar({ 
  height = 170, 
  weight = 70, 
  chest = null, 
  waist = null, 
  hips = null, 
  inseam = null, 
  muscleMass = 0.5, 
  lightIntensity = 0.8, 
  backgroundColor = "#f5f5f5" 
}) {
  const [avatarData, setAvatarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [measurementsInfo, setMeasurementsInfo] = useState({});

  useEffect(() => {
    const fetchAvatarData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 사용자가 입력한 값이 있으면 그대로 사용, 없으면 예측값 사용
        const finalChest = chest || 0;  // null 체크 개선
        const finalWaist = waist || 0;
        const finalHips = hips || 0;
        const finalInseam = inseam || 0;
        
        console.log("Avatar 요청 데이터:", {
          height, weight, 
          chest: finalChest, 
          waist: finalWaist, 
          hips: finalHips, 
          inseam: finalInseam, 
        });
        
        // 아바타 생성 요청
        const response = await axios.post('http://localhost:8000/generate-avatar/', {
          height: height,
          weight: weight,
          chest: finalChest,
          waist: finalWaist,
          hips: finalHips,
          inseam: finalInseam,
        });
        
        console.log("아바타 응답 데이터:", response.data);
        
        if (response.data.error) {
          throw new Error(response.data.error);
        }
        
        setAvatarData(response.data);
        
        // 측정 정보 저장
        if (response.data.measurements) {
          setMeasurementsInfo(response.data.measurements);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('아바타 데이터를 가져오는 데 실패했습니다:', error);
        
        let userErrorMessage = "서버 연결에 실패했습니다. 네트워크 연결을 확인하세요.";
        if (error.response) {
          userErrorMessage = `서버 오류: ${error.response.status} ${error.response.statusText}`;
          console.error('오류 응답 데이터:', error.response.data);
        } else if (error.message) {
          userErrorMessage = error.message;
        }
        
        setError(userErrorMessage);
        setLoading(false);
        setAvatarData(null);
      }
    };

    fetchAvatarData();
  }, [height, weight, chest, waist, hips, inseam]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-96 bg-gray-50 dark:bg-gray-900/30 rounded-lg shadow-inner">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary mb-4"></div>
      <p className="text-gray-600 dark:text-gray-300 font-medium">아바타 생성 중...</p>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
      <div className="flex items-center mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <p className="font-semibold text-red-700 dark:text-red-400">오류 발생</p>
      </div>
      <p className="text-red-600 dark:text-red-300">{error}</p>
    </div>
  );
  
  if (!avatarData || !avatarData.vertices || !avatarData.faces) return (
     <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border border-yellow-200 dark:border-yellow-800 shadow-sm">
      <div className="flex items-center mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <p className="font-semibold text-yellow-700 dark:text-yellow-400">알림</p>
      </div>
      <p className="text-yellow-600 dark:text-yellow-300">아바타 데이터를 불러오지 못했습니다.</p>
    </div>
  );

  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700" style={{ 
      background: `linear-gradient(to bottom, ${backgroundColor}, ${adjustColor(backgroundColor, -20)})` 
    }}>
      <div className="relative w-full h-full">
        <Canvas camera={{ position: [0, 1, 2] }}>
          <ambientLight intensity={lightIntensity * 0.8} />
          <directionalLight position={[1, 2, 3]} intensity={lightIntensity} castShadow />
          <directionalLight position={[-1, 2, -3]} intensity={lightIntensity * 0.6} />
          <pointLight position={[0, 3, 0]} intensity={lightIntensity * 0.8} />
          <hemisphereLight intensity={lightIntensity * 0.4} groundColor="#080820" />
          
          {avatarData?.vertices && avatarData?.faces && (
            <AvatarMesh 
              vertices={avatarData.vertices} 
              faces={avatarData.faces} 
            />
          )}
          
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            minDistance={0.1} 
            maxDistance={Infinity}
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
            target={[0, 0.8, 0]}
          />
        </Canvas>
        
        <div className="absolute bottom-4 right-4 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm px-3 py-2 rounded-lg text-xs text-gray-600 dark:text-gray-300 shadow-md">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex items-center space-x-1">
              <span className="font-medium">키:</span>
              <span>{height}cm</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-medium">몸무게:</span>
              <span>{weight}kg</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-medium">가슴:</span>
              <span>{chest || '계산 중...'}cm</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-medium">허리:</span>
              <span>{waist || '계산 중...'}cm</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-medium">엉덩이:</span>
              <span>{hips || '계산 중...'}cm</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-medium">인심:</span>
              <span>{inseam || '계산 중...'}cm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}