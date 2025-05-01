import { useState, useEffect } from 'react'
import Avatar from './components/Avatar'
import axios from 'axios'

function App() {
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(70);
  const [chest, setChest] = useState(null);
  const [waist, setWaist] = useState(null);
  const [hips, setHips] = useState(null);
  const [inseam, setInseam] = useState(null);
  const [muscleMass, setMuscleMass] = useState(0.5);
  
  const [predictedMeasurements, setPredictedMeasurements] = useState({
    chest: 0,
    waist: 0,
    hips: 0,
    inseam: 0
  });
  
  const [generate, setGenerate] = useState(false);
  const [isFormDisabled, setIsFormDisabled] = useState(false);
  const [lightIntensity, setLightIntensity] = useState(0.8);
  const [backgroundColor, setBackgroundColor] = useState("#f5f5f5");
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 키와 몸무게가 변경될 때마다 예측 치수 업데이트
  useEffect(() => {
    const fetchPredictedMeasurements = async () => {
      try {
        // GET 요청을 POST로 변경
        const response = await axios.post('http://localhost:8000/predict-measurements/', {
          height: height,
          weight: weight
        });
        
        console.log('예측 측정값 요청 데이터:', { height, weight });
        console.log('예측 측정값 응답:', response.data);
        
        setPredictedMeasurements(response.data);
      } catch (error) {
        console.error('예측 측정값을 가져오는 데 실패했습니다:', error);
        // 여기서 오류 세부 정보 확인
        if (error.response) {
          console.error('오류 응답:', error.response.status, error.response.data);
        }
      }
    };
    
    fetchPredictedMeasurements();
  }, [height, weight]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setGenerate(true);
    setIsFormDisabled(true);
  };

  const handleReset = () => {
    setGenerate(false);
    setIsFormDisabled(false);
  };
  
  const resetMeasurement = (setter) => {
    setter(null);
  };

  const updateMeasurement = async (setter, value, paramName) => {
    setter(value);
    
    try {
      const response = await axios.post('http://localhost:8000/adjust-measurements/', {
        height: height,
        weight: weight,
        changed_param: paramName,
        changed_value: value
      });
      
      console.log('측정값 조정 응답:', response.data);
      
      // 변경된 파라미터를 제외한 나머지 값들만 업데이트
      if (response.data.chest && paramName !== 'chest') {
        setChest(response.data.chest);
      }
      if (response.data.waist && paramName !== 'waist') {
        setWaist(response.data.waist);
      }
      if (response.data.hips && paramName !== 'hips') {
        setHips(response.data.hips);
      }
      if (response.data.inseam && paramName !== 'inseam') {
        setInseam(response.data.inseam);
      }
      
      // 예측 측정값도 업데이트하여 UI가 일관되게 표시되도록 함
      setPredictedMeasurements(prev => ({
        ...prev,
        chest: response.data.chest || prev.chest,
        waist: response.data.waist || prev.waist,
        hips: response.data.hips || prev.hips,
        inseam: response.data.inseam || prev.inseam
      }));
    } catch (error) {
      console.error('측정값 조정 중 오류 발생:', error);
      if (error.response) {
        console.error('오류 응답:', error.response.status, error.response.data);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-gray-100 dark:from-darkBg dark:to-gray-900 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-3">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              정밀 3D 아바타 생성기
            </span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
            신체 치수를 입력하고 정확한 3D 아바타를 생성해보세요.
          </p>
        </div>
        
        <div className="card max-w-md mx-auto mb-10 bg-white/90 backdrop-blur-sm dark:bg-gray-800/90 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="height" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  키 (cm)
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    id="height" 
                    value={height} 
                    onChange={(e) => setHeight(Number(e.target.value))} 
                    min="100" 
                    max="220"
                    step="0.1"
                    disabled={isFormDisabled}
                    className={`w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white ${isFormDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">cm</span>
                </div>
              </div>
              
              <div>
                <label htmlFor="weight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  몸무게 (kg)
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    id="weight" 
                    value={weight} 
                    onChange={(e) => setWeight(Number(e.target.value))} 
                    min="30" 
                    max="150"
                    step="0.1"
                    disabled={isFormDisabled}
                    className={`w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white ${isFormDisabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">kg</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center pt-4 space-x-4">
              <button
                type="submit"
                className={`px-6 py-3 bg-blue-500 text-white font-medium rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                  generate ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                }`}
                disabled={generate}
              >
                아바타 생성하기
              </button>
              
              {generate && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  다시 설정하기
                </button>
              )}
            </div>
          </form>
        </div>
        
        {generate && (
          <div className="mb-8">
            <div className="mb-6 bg-white/90 dark:bg-gray-800/90 rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">시각화 설정</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lightIntensity" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    조명 밝기
                  </label>
                  <input
                    type="range"
                    id="lightIntensity"
                    min="0.2"
                    max="1.5"
                    step="0.1"
                    value={lightIntensity}
                    onChange={(e) => setLightIntensity(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
                
                <div>
                  <label htmlFor="backgroundColor" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    배경 색상
                  </label>
                  <div className="flex items-center">
                    <input
                      type="color"
                      id="backgroundColor"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-8 h-8 p-0 border-0 rounded-md cursor-pointer"
                    />
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{backgroundColor}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6 bg-white/90 dark:bg-gray-800/90 rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">신체 측정값 조정</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-3">
                아래 값을 조정하여 아바타를 실시간으로 업데이트할 수 있습니다.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="chest-adjust" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    가슴 둘레 (cm)
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      id="chest-adjust" 
                      value={chest !== null ? chest : predictedMeasurements.chest} 
                      onChange={(e) => updateMeasurement(setChest, Number(e.target.value), 'chest')}
                      min="50" 
                      max="150"
                      step="0.1"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">cm</span>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="waist-adjust" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    허리 둘레 (cm)
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      id="waist-adjust" 
                      value={waist !== null ? waist : predictedMeasurements.waist} 
                      onChange={(e) => updateMeasurement(setWaist, Number(e.target.value), 'waist')}
                      min="40" 
                      max="140"
                      step="0.1"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">cm</span>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="hips-adjust" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    엉덩이 둘레 (cm)
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      id="hips-adjust" 
                      value={hips !== null ? hips : predictedMeasurements.hips} 
                      onChange={(e) => updateMeasurement(setHips, Number(e.target.value), 'hips')}
                      min="50" 
                      max="150"
                      step="0.1"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">cm</span>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="inseam-adjust" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    인심 길이 (cm)
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      id="inseam-adjust" 
                      value={inseam !== null ? inseam : predictedMeasurements.inseam} 
                      onChange={(e) => updateMeasurement(setInseam, Number(e.target.value), 'inseam')}
                      min="40" 
                      max="120"
                      step="0.1"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">cm</span>
                  </div>
                </div>
              </div>
            </div>
            
            <Avatar 
              height={height}
              weight={weight}
              chest={chest !== null ? chest : predictedMeasurements.chest}
              waist={waist !== null ? waist : predictedMeasurements.waist}
              hips={hips !== null ? hips : predictedMeasurements.hips}
              inseam={inseam !== null ? inseam : predictedMeasurements.inseam}
              lightIntensity={lightIntensity}
              backgroundColor={backgroundColor}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default App