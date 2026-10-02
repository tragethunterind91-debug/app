// ZNQ Network — company wordmark (minimal, matches the circled reference).
// Uses SVG <text> for crisp scaling at any size.
export default function ZnqLogo({ height = 44, color = '#ffffff', subColor = 'rgba(255,255,255,0.85)', style = {}, className = '', title = 'ZNQ Network' }) {
  const w = height * (280 / 100);
  return (
    <svg
      className={className}
      style={style}
      width={w}
      height={height}
      viewBox="0 0 280 100"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <text
        x="140"
        y="60"
        textAnchor="middle"
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        fontSize="60"
        fontWeight="600"
        letterSpacing="4"
        fill={color}
      >
        ZNQ
      </text>
      <text
        x="140"
        y="88"
        textAnchor="middle"
        fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
        fontSize="11"
        fontWeight="300"
        letterSpacing="8"
        fill={subColor}
      >
        NETWORK
      </text>
    </svg>
  );
}
