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
          background: '#1A1A1A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: s * 0.22,
        }}
      >
        <div
          style={{
            color: '#C9A84C',
            fontSize: s * 0.55,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          M
        </div>
      </div>
    ),
    { width: s, height: s }
  );
}
