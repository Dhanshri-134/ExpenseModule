export function BellIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 22a2.2 2.2 0 0 0 2.1-1.6H9.9A2.2 2.2 0 0 0 12 22Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.2 17.2h11.6c-1.5-1.6-2.2-3.2-2.2-6.1 0-3-1.6-5.2-3.9-5.8-.2-.8-.9-1.3-1.7-1.3s-1.5.5-1.7 1.3C6.9 6 5.3 8.2 5.3 11.1c0 2.9-.7 4.5-2.2 6.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MenuIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoutIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M10 7H6.5A2.5 2.5 0 0 0 4 9.5v5A2.5 2.5 0 0 0 6.5 17H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 12H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BaseStrokeIcon({ className, children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export function DashboardIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M4.5 5.5h6v6h-6zM13.5 5.5h6v9h-6zM4.5 14.5h6v4h-6zM13.5 17.5h6v1h-6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </BaseStrokeIcon>
  );
}

export function ProjectsIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M4.5 8.5h15M8 5.5h8l1.5 3H6.5L8 5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 8.5h14v9.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18V8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </BaseStrokeIcon>
  );
}

export function TeamIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 18.5a4.5 4.5 0 0 1 9 0M14 18.5a3.5 3.5 0 0 1 6 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseStrokeIcon>
  );
}

export function LeadsIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M7.5 7.5h9M7.5 12h9M7.5 16.5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6 4.5h12A1.5 1.5 0 0 1 19.5 6v12A1.5 1.5 0 0 1 18 19.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </BaseStrokeIcon>
  );
}

export function ClientsIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M8.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15.5 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 19a4.5 4.5 0 0 1 8 0M13.5 19a3.5 3.5 0 0 1 6 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseStrokeIcon>
  );
}

export function InsightsIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M5 18.5V13M11.5 18.5V9.5M18 18.5V5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4.5 18.5h15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseStrokeIcon>
  );
}

export function AccentSparkIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9-1.9 5.7-1.9-5.7L4.5 10.9 10.1 9 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </BaseStrokeIcon>
  );
}

export function CalendarIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M7 4.5v3M17 4.5v3M4.5 9.5h15M5 7.5h14v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18V7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseStrokeIcon>
  );
}

export function ReportIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M6 4.5h9l3 3v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 18V6a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseStrokeIcon>
  );
}

export function ExpenseIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M4.5 7.5h15v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 10.5h15M9 14.5h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseStrokeIcon>
  );
}

export function SettingsIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19 12a7.5 7.5 0 0 0-.1-1.1l2-1.6-1.9-3.3-2.4 1a7.9 7.9 0 0 0-1.9-1.1L14.4 3h-4.8l-.3 2.8a7.9 7.9 0 0 0-1.9 1.1l-2.4-1-1.9 3.3 2 1.6A7.5 7.5 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.6 1.9 3.3 2.4-1a7.9 7.9 0 0 0 1.9 1.1l.3 2.8h4.8l.3-2.8a7.9 7.9 0 0 0 1.9-1.1l2.4 1 1.9-3.3-2-1.6c.1-.3.1-.7.1-1.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </BaseStrokeIcon>
  );
}

export function CheckCircleIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m8.5 12 2.3 2.3 4.7-4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseStrokeIcon>
  );
}

export function PauseCircleIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M10 9v6M14 9v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseStrokeIcon>
  );
}

export function PulseIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M3.5 12h3.2l1.9-3.6 3.2 7.2 2.3-4h6.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseStrokeIcon>
  );
}

export function ChevronRightIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="m10 7 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseStrokeIcon>
  );
}

export function SpinnerIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseStrokeIcon>
  );
}

export function EyeIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </BaseStrokeIcon>
  );
}

export function EyeOffIcon({ className }) {
  return (
    <BaseStrokeIcon className={className}>
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.1 0 9.5 7 9.5 7a15.8 15.8 0 0 1-3.2 4.1M6.2 6.7C3.9 8.3 2.5 12 2.5 12s3.4 6 9.5 6c1.7 0 3.2-.5 4.5-1.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9A3 3 0 0 0 14.1 14.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseStrokeIcon>
  );
}
