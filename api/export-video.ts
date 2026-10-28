export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const captions = req.body?.captions ? JSON.parse(req.body.captions) : [];
    
    // Format high-precision SRT
    let srtContent = '';
    captions.forEach((c: any, index: number) => {
      const startSec = typeof c.startSec === 'number' ? c.startSec : (parseFloat(c.start) || 0);
      const endSec = typeof c.endSec === 'number' ? c.endSec : (parseFloat(c.end) || (startSec + 2.5));
      
      const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
      };

      srtContent += `${index + 1}\n${formatTime(startSec)} --> ${formatTime(endSec)}\n${(c.text || '').trim()}\n\n`;
    });

    return res.status(200).json({
      success: true,
      message: 'Serverless render configuration prepared',
      srtContent,
      segmentCount: captions.length
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Export processing error' });
  }
}
