interface KryvexBrandProps {
  compact?: boolean;
}

export default function KryvexBrand({ compact = false }: KryvexBrandProps) {
  return (
    <div className={`kryvex-brand${compact ? ' kryvex-brand--compact' : ''}`}>
      <img className="kryvex-brand__mark" src="/kryvex-mark.svg" alt="" aria-hidden="true" />
      <div className="kryvex-brand__copy">
        <strong className="kryvex-brand__name">KRYVEX</strong>
        <span className="kryvex-brand__tagline">Rise Above Rivals.</span>
      </div>
    </div>
  );
}
