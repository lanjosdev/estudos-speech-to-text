import { useState, useEffect } from 'react';
import axios from 'axios';

// Function para converter blob de áudio em string codificada em base64
const audioBlobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const arrayBuffer = reader.result;
      const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );
      resolve(base64Audio);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
};

export default function App() {
  if (!import.meta.env.VITE_GOOGLE_API_KEY) {
    throw new Error("VITE_GOOGLE_API_KEY não encontrada/definada nas variaveis de ambiente"); // throw encerra o programa (temporario pois estraga a UX)
  }
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [transcription, setTranscription] = useState('');

  // Função de limpeza para interromper a gravação e liberar recursos de mídia
  useEffect(() => {
    return ()=> {
      if(mediaRecorder) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaRecorder]);
  

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); //Aguarda a permissão do usuário para acessar o dispositivo de áudio

      const recorder = new MediaRecorder(stream);
      recorder.start(); //Inicia a gravação de voz
      console.log('Recording started');
      setRecording(true);
      setMediaRecorder(recorder);

      // Esperando concluir o que está sendo salvo na const recorder para tratar o dado concluido (quando usuario finalizar/concluir a gravação no botao)
      recorder.addEventListener('dataavailable', async(event) => {
        console.log('Adicionando e convertendo dado da gravação');
        const audioBlob = event.data;

        // chama função que converte o dado da gravação local
        const base64Audio = await audioBlobToBase64(audioBlob); // Esse await não trata excessao (sem try)
        //console.log('Base64 audio:', base64Audio);

        // ENVIANDO DADO DE GRAVAÇÃO PARA API GCP:
        try {
          const startTime = performance.now();

          const response = await axios.post(
            `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
            {
              config: {
                encoding: 'WEBM_OPUS',
                sampleRateHertz: 48000,
                languageCode: 'pt-BR',
              },
              audio: {
                content: base64Audio,
              },
            }
          );

          const endTime = performance.now();
          const elapsedTime = endTime - startTime;
          console.log('Tempo do retorno da API (ms):', elapsedTime);

          // Imprimi o resultado (transcrição):
          if(response.data.results && response.data.results.length > 0) {
            setTranscription(response.data.results[0].alternatives[0].transcript);
          } else {
            console.log('Nenhum resultado de transcrição na resposta da API:', response.data);
            setTranscription('Nenhuma transcrição disponível');
          }
        } catch (error) {
          console.error('Erro com a API do Google Speech-to-Text:', error.response.data);
        }
      });

      // setMediaRecorder(recorder);
    } catch (error) {
      console.error('Erro ao obter mídia do usuário', error);
    }
  }

  function stopRecording() {
    //Se está durante a gravação local, então:
    if(mediaRecorder) { 
      mediaRecorder.stop(); //Termina a gravação de voz
      console.log('Recording stopped');
      setRecording(false);
    }
  }


  return (
    <div>
      <h1>Teste de API (Cloud Speech-to-Text)</h1>

      {!recording ? (
        <button onClick={startRecording}>Iniciar gravação</button>
      ) : (
        <button onClick={stopRecording}>Terminar gravação</button>
      )}

      <p>Transcrição: {transcription}</p>
    </div>
  );
}