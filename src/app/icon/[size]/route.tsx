import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = Number(size) || 512;

  return new ImageResponse(
    (
      <div
        style={{
          width: s,
          height: s,
          background: 'linear-gradient(135deg, #C9A84C 0%, #A8873B 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: s * 0.22,
        }}
      >
        <div
          style={{
            color: '#1A1A1A',
            fontSize: s * 0.55,
            fontWeight: 900,
            lineHeight: 1,
            textShadow: `0 ${s * 0.02}px ${s * 0.04}px rgba(255,255,255,0.3)`,
          }}
        >
          ✦
        </div>
      </div>
    ),
    { width: s, height: s }
  );
}
