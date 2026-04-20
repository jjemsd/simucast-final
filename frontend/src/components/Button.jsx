// ============================================================================
// Button.jsx
// ============================================================================
// A reusable button with three visual styles.
// Prevents copy-pasting the same Tailwind classes all over the app.
//
// Props:
//   variant — 'primary' | 'secondary' | 'ghost' (default 'primary')
//   size    — 'sm' | 'md' (default 'md')
//   disabled, onClick, children, ...rest — standard <button> props
// ============================================================================

const VARIANT_CLASSES = {
  primary: 'bg-brand-500 hover:bg-brand-600 text-white',
  secondary: 'bg-white border border-gray-200 hover:border-brand-400 text-gray-700',
  ghost: 'text-gray-600 hover:bg-gray-100',
}

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-1',
  md: 'text-xs px-3 py-1.5',
}


export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
  className = '',
  ...rest
}) {
  const classes =
    VARIANT_CLASSES[variant] + ' ' +
    SIZE_CLASSES[size] + ' ' +
    'font-medium rounded-md transition-colors disabled:opacity-50 ' +
    className

  return (
    <button onClick={onClick} disabled={disabled} className={classes} {...rest}>
      {children}
    </button>
  )
}
