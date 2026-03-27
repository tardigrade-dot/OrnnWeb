import {Link} from 'react-router-dom';

const tools = [
  {
    name: 'FlameGraph Analyzer',
    path: '/FlameGraphAnalyzer',
    description: '深度集成 AI 交互能力，让复杂的火焰图堆栈分析变得直观易懂。',
  },
  {
    name: 'GitDir Downloader',
    path: '/GitDirDownloader',
    description: '轻量级工具，支持快速下载 GitHub/GitLab 仓库中的特定子目录或单文件。',
  },
  {
    name: 'EPUB-CC',
    path: '/EpubCc',
    description: '专为电子书爱好者打造，实现 EPUB 格式文件的繁简无损转换。',
  },
  {
    name: 'MNIST-Drawer',
    path: '/MnistDrawer',
    description: 'MNIST绘图工具',
  },
  {
    name: 'WAV Audio Trimmer',
    path: '/WavAudioTrimmer',
    description: 'WAV音频裁剪工具',
  },
  {
    name: 'Star Typer',
    path: '/StarTyper',
    description: '星空打字机',
  },
  {
    name: 'Audio Subtitle Visualizer',
    path: '/AudioSubtitleVisualizer',
    description: '音频字幕可视化编辑工具',
  },
  {
    name: 'Image Annotator',
    path: '/ImageAnnotator',
    description: '图片标注工具',
  },
];

export function HubPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-12 text-center bg-gradient-to-r from-white to-[var(--primary-color)] bg-clip-text text-transparent">
        OrnnWeb Tools
      </h1>

      <div className="flex flex-wrap gap-6 justify-center max-w-5xl">
        {tools.map((tool) => (
          <Link
            key={tool.path}
            to={tool.path}
            className="flex-1 min-w-[280px] max-w-[350px] p-6 bg-[var(--card-bg)] border border-white/10 rounded-xl hover:border-[var(--primary-color)] hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 transition-all duration-300"
          >
            <span className="text-[var(--primary-color)] font-bold text-lg flex items-center gap-2 mb-3">
              <span className="text-opacity-70">◈</span>
              {tool.name}
            </span>
            <p className="text-[var(--text-dim)] text-sm leading-relaxed">
              {tool.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
