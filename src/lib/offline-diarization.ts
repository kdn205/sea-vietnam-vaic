import SherpaOnnx, { Diarization } from '@siteed/sherpa-onnx.rn';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const ROOT_DIR = `${FileSystem.documentDirectory}offline-diarization/`;
const SEGMENTATION_ARCHIVE = `${ROOT_DIR}segmentation.tar.bz2`;
const SEGMENTATION_DIR = `${ROOT_DIR}sherpa-onnx-pyannote-segmentation-3-0/`;
const SEGMENTATION_MODEL = `${SEGMENTATION_DIR}model.int8.onnx`;
const EMBEDDING_MODEL =
  `${ROOT_DIR}3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx`;

const SEGMENTATION_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/' +
  'speaker-segmentation-models/' +
  'sherpa-onnx-pyannote-segmentation-3-0.tar.bz2';
const EMBEDDING_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/' +
  'speaker-recongition-models/' +
  '3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx';

export type OfflineDiarizationSegment = {
  speakerId: number;
  speakerLabel: string;
  startMs: number;
  endMs: number;
};

export type OfflineDiarizationOutput = {
  durationMs: number;
  numSpeakers: number;
  segments: OfflineDiarizationSegment[];
};

let initialized = false;

async function exists(path: string) {
  return (await FileSystem.getInfoAsync(path)).exists;
}

export async function isOfflineDiarizationInstalled() {
  if (Platform.OS === 'web') return false;

  const [segmentationExists, embeddingExists] = await Promise.all([
    exists(SEGMENTATION_MODEL),
    exists(EMBEDDING_MODEL),
  ]);
  return segmentationExists && embeddingExists;
}

async function download(
  url: string,
  destination: string,
  onProgress: (progress: number) => void
) {
  const task = FileSystem.createDownloadResumable(
    url,
    destination,
    {},
    ({ totalBytesExpectedToWrite, totalBytesWritten }) => {
      if (totalBytesExpectedToWrite > 0) {
        onProgress(totalBytesWritten / totalBytesExpectedToWrite);
      }
    }
  );
  const result = await task.downloadAsync();
  if (!result?.uri) {
    throw new Error('Không tải được model.');
  }
}

export async function installOfflineDiarization(
  onProgress: (progress: number, message: string) => void
) {
  if (Platform.OS === 'web') {
    throw new Error('Diarization offline hiện chỉ hỗ trợ Android và iOS.');
  }

  await FileSystem.makeDirectoryAsync(ROOT_DIR, { intermediates: true });

  if (!(await exists(SEGMENTATION_MODEL))) {
    onProgress(0, 'Đang tải model phân đoạn...');
    await download(SEGMENTATION_URL, SEGMENTATION_ARCHIVE, (value) =>
      onProgress(value * 0.25, 'Đang tải model phân đoạn...')
    );
    onProgress(0.25, 'Đang giải nén model phân đoạn...');
    const extraction = await SherpaOnnx.Archive.extractTarBz2(
      SEGMENTATION_ARCHIVE,
      ROOT_DIR
    );
    if (!extraction.success) {
      throw new Error(extraction.message || 'Không giải nén được model.');
    }
    await FileSystem.deleteAsync(SEGMENTATION_ARCHIVE, { idempotent: true });
  }

  if (!(await exists(EMBEDDING_MODEL))) {
    onProgress(0.3, 'Đang tải model nhận diện người nói...');
    await download(EMBEDDING_URL, EMBEDDING_MODEL, (value) =>
      onProgress(0.3 + value * 0.7, 'Đang tải model nhận diện người nói...')
    );
  }

  onProgress(1, 'Model đã sẵn sàng để chạy offline.');
}

async function initialize() {
  if (initialized) return;
  if (!(await isOfflineDiarizationInstalled())) {
    throw new Error('Model diarization chưa được cài trên thiết bị.');
  }

  const result = await Diarization.init({
    segmentationModelDir: SEGMENTATION_DIR,
    segmentationModelFile: 'model.int8.onnx',
    embeddingModelFile: EMBEDDING_MODEL,
    numThreads: 2,
    provider: 'cpu',
    debug: false,
    numClusters: -1,
    threshold: 0.5,
  });
  if (!result.success) {
    throw new Error(result.error || 'Không khởi tạo được diarization engine.');
  }
  initialized = true;
}

export async function diarizeAudioFile(
  fileUri: string,
  numSpeakers: number = -1
): Promise<OfflineDiarizationOutput> {
  if (Platform.OS === 'web') {
    throw new Error('Diarization offline hiện chỉ hỗ trợ Android và iOS.');
  }

  await initialize();
  const result = await Diarization.processFile(fileUri, numSpeakers, 0.5);
  if (!result.success) {
    throw new Error(result.error || 'Không phân tách được người nói.');
  }

  return {
    durationMs: result.durationMs,
    numSpeakers: result.numSpeakers,
    segments: result.segments.map((segment) => ({
      speakerId: segment.speaker,
      speakerLabel: `Speaker ${segment.speaker + 1}`,
      startMs: Math.round(segment.start * 1000),
      endMs: Math.round(segment.end * 1000),
    })),
  };
}

export async function releaseOfflineDiarization() {
  if (!initialized) return;
  await Diarization.release();
  initialized = false;
}
