import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#2D6A4F',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5F0E8',
          fontWeight: 700,
          fontSize: 18,
          fontFamily: 'sans-serif',
          letterSpacing: '-0.5px',
        }}
      >
        E
      </div>
    ),
    { ...size },
  );
}
