

function extractWords(text) {
  const words = text
    .split(/\s+/)                         // 按空格分割
    .map(w => w.replace(/[^a-zA-Z]/g, "")) // 去掉非字母
    .filter(w => w.length >= 3)            // 去掉短词
    .filter(w => !w.includes("'"))         // 去掉包含 '
    .map(w => w.toLowerCase());            // 统一大小写

  return [...new Set(words)];              // 去重
}
const handleGenerateAIWords = async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.remoteHost = 'https://modelscope.cn';
    const domainInput = '汽车制造';
    // const modelId = 'HuggingFaceTB/SmolLM2-360M-Instruct';
    const modelId = 'onnx-community/Qwen2.5-0.5B-Instruct';

    console.log(`start load model ${modelId}...`);
    const generator = await pipeline('text-generation', modelId, {
        device: 'cpu',
        dtype: 'fp16', // 4-bit quantization for faster inference
        progress_callback: (p) => {
            if (p.status === 'progress') {
                console.log(p.progress);
            }
        },
        
    });
    const prompt = `according to "${domainInput}", Generate 100 unique, professional terms. `;

    const messages = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
    ];
    console.log("start generate words...");
    const output = await generator(messages, { max_new_tokens: 2048, do_sample: false, enable_thinking: false });

    const generatedText = output[0].generated_text.at(-1).content

    console.log("generatedText: ",generatedText)
    const words = extractWords(generatedText);
    console.log("words: ",words)
};
// handleGenerateAIWords();
async function mask_test(){

    const { pipeline, env } = await import('@huggingface/transformers');
    env.remoteHost = 'https://modelscope.cn';
    const unmasker = await pipeline('fill-mask', 'Xenova/bert-base-chinese',{
        device: 'cpu',
        dtype: 'fp16', // 4-bit quantization for faster inference
        progress_callback: (p) => {
            if (p.status === 'progress') {
                console.log(p.progress);
            }
        },
        
    });
    undefined_word = ['著', '發', '樂', '後', '覺', '乾', '裡', '會', '髮', '費', '對', '標', '愛', '麵', '裝', '視', '廣', '龍', '雲', '鳥', '機', '藝', '書', '雜', '錢', '頭', '錄', '顏', '體', '龜', '魚']
    const output = await unmasker(['The goal of life is [MASK].', '随[MASK]中文版《非驴非马》在反复修改后逐渐成形，我才由遥远模糊的记忆中回想起']);
    console.log(output)
}
mask_test()