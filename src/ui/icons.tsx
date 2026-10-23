import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const BottleIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 2h4M10.5 2v3l-2 2.5V20a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V7.5l-2-2.5V2" />
    <path d="M8.5 12h3M8.5 16h3" />
  </Base>
)
export const BreastIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </Base>
)
export const MoonIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Base>
)
export const SunIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
)
export const DiaperIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 7h18v3a9 9 0 0 1-18 0z" />
    <path d="M8 7v3M16 7v3" />
  </Base>
)
export const PillIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
    <path d="M9.5 9.5l5 5" />
  </Base>
)
export const NoteIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 3h10l4 4v14H5z" />
    <path d="M9 12h6M9 16h4" />
  </Base>
)
export const MicIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Base>
)
export const SendIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12l16-8-6 16-2-6z" />
  </Base>
)
export const ShareIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Base>
)
export const TrashIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Base>
)
export const PencilIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3" />
  </Base>
)
export const TodayIcon =(p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Base>
)
export const HandoffIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 10l-3 3 3 3M4 13h11M17 14l3-3-3-3M20 11H9" />
  </Base>
)
export const SparkIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
  </Base>
)
export const CloseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
)
export const PlayIcon = (p: IconProps) => (
  <Base {...p} fill="currentColor" stroke="none">
    <path d="M8 5v14l11-7z" />
  </Base>
)
export const StopIcon = (p: IconProps) => (
  <Base {...p} fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Base>
)
export const ChartIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20h16M7 16V9M11 16V5M15 16v-4M19 16V8" />
  </Base>
)
export const HomeIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Base>
)
export const PauseIcon = (p: IconProps) => (
  <Base {...p} fill="currentColor" stroke="none">
    <rect x="6" y="5" width="4" height="14" rx="1.2" />
    <rect x="14" y="5" width="4" height="14" rx="1.2" />
  </Base>
)
export const PlusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)
export const MinusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
)
export const ClockIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
)
export const ListIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Base>
)
export const FaceIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
  </Base>
)
export const SwapIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 7h12l-3-3M17 17H5l3 3" />
  </Base>
)
export const ChevronLeftIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
)
export const ChevronRightIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 5l7 7-7 7" />
  </Base>
)
export const BulbIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </Base>
)
export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </Base>
)
export const LogoIcon = (p: IconProps) => (
  <Base {...p} strokeWidth="1.6">
    <path d="M15.5 4.5A7.5 7.5 0 1 0 19.5 16 6 6 0 0 1 15.5 4.5z" fill="currentColor" fillOpacity="0.18" />
    <path d="M17.5 3.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" />
  </Base>
)
