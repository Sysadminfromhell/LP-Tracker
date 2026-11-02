interface KryvexBrandProps {
  compact?: boolean;
  iconOnly?: boolean;
}

export default function KryvexBrand({ compact = false, iconOnly = false }: KryvexBrandProps) {
  const className = [
    'kryvex-brand',
    compact ? 'kryvex-brand--compact' : '',
    iconOnly ? 'kryvex-brand--icon-only' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <img
        className="kryvex-brand__mark"
        src="/kryvex-mark.svg"
        alt={iconOnly ? 'KRYVEX' : ''}
        aria-hidden={iconOnly ? undefined : true}
      />
      {!iconOnly && (
        <div className="kryvex-brand__copy">
          <strong className="kryvex-brand__name">KRYVEX</strong>
          <span className="kryvex-brand__tagline">Rise Above Rivals.</span>
        </div>
      )}
    </div>
  );
}
