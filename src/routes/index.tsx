import {createHashRouter} from 'react-router-dom';
import {lazy, Suspense} from 'react';
import {HubPage} from '../pages/HubPage';
import {SuspenseFallback} from '../components/SuspenseFallback';

const FlameGraphAnalyzer = lazy(() => import('../tools/FlameGraphAnalyzer/App'));
const GitDirDownloader = lazy(() => import('../tools/GitDirDownloader/App'));
const EpubCc = lazy(() => import('../tools/EpubCc/App'));
const MnistDrawer = lazy(() => import('../tools/MnistDrawer/App'));
const WavAudioTrimmer = lazy(() => import('../tools/WavAudioTrimmer/App'));
const StarTyper = lazy(() => import('../tools/StarTyper/App'));
const AudioSubtitleVisualizer = lazy(() => import('../tools/AudioSubtitleVisualizer/App'));
const ImageAnnotator = lazy(() => import('../tools/ImageAnnotator/App'));

export const router = createHashRouter([
  {path: '/', element: <HubPage />},
  {
    path: '/FlameGraphAnalyzer',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <FlameGraphAnalyzer />
      </Suspense>
    ),
  },
  {
    path: '/GitDirDownloader',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <GitDirDownloader />
      </Suspense>
    ),
  },
  {
    path: '/EpubCc',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <EpubCc />
      </Suspense>
    ),
  },
  {
    path: '/MnistDrawer',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <MnistDrawer />
      </Suspense>
    ),
  },
  {
    path: '/WavAudioTrimmer',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <WavAudioTrimmer />
      </Suspense>
    ),
  },
  {
    path: '/StarTyper',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <StarTyper />
      </Suspense>
    ),
  },
  {
    path: '/AudioSubtitleVisualizer',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <AudioSubtitleVisualizer />
      </Suspense>
    ),
  },
  {
    path: '/ImageAnnotator',
    element: (
      <Suspense fallback={<SuspenseFallback />}>
        <ImageAnnotator />
      </Suspense>
    ),
  },
]);
