const imageTiles = {
  mug: [0, 0], tote: [1, 0], lamp: [2, 0], headphones: [3, 0],
  camera: [0, 1], watch: [1, 1], sneaker: [2, 1], bottle: [3, 1],
  serum: [0, 2], throw: [1, 2], journal: [2, 2], speaker: [3, 2],
  'coffee-set': [0, 3], sunglasses: [1, 3], planter: [2, 3], backpack: [3, 3],
};

const starts = [8, 319, 631, 943];

/** Renders local showcase sprite tiles inline so the image works in every browser. */
export default function ProductImage({ src, alt = '', className = '', ...props }) {
  const tileName = src?.match(/contact-sheet\.png#([\w-]+)/)?.[1];
  const tile = imageTiles[tileName];

  if (!tile) {
    return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" {...props} />;
  }

  const [column, row] = tile;
  const x = starts[column];
  const y = [4, 314, 621, 923][row];
  return (
    <svg
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      viewBox={`${x} ${y} 300 300`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      {...props}
    >
      <image href="/showcase-products/contact-sheet.png" x="0" y="0" width="1254" height="1254" />
    </svg>
  );
}
