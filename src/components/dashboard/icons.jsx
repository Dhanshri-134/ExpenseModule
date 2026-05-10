import {
  Activity,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FolderKanban,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Menu,
  PauseCircle,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

function renderIcon(Icon, { className, ...rest }) {
  return <Icon aria-hidden="true" className={className} strokeWidth={1.8} {...rest} />;
}

export function BellIcon(props) {
  return renderIcon(Bell, props);
}

export function MenuIcon(props) {
  return renderIcon(Menu, props);
}

export function LogoutIcon(props) {
  return renderIcon(LogOut, props);
}

export function DashboardIcon(props) {
  return renderIcon(LayoutGrid, props);
}

export function ProjectsIcon(props) {
  return renderIcon(FolderKanban, props);
}

export function TeamIcon(props) {
  return renderIcon(Users, props);
}

export function LeadsIcon(props) {
  return renderIcon(BriefcaseBusiness, props);
}

export function ClientsIcon(props) {
  return renderIcon(Users, props);
}

export function InsightsIcon(props) {
  return renderIcon(BarChart3, props);
}

export function AccentSparkIcon(props) {
  return renderIcon(Sparkles, props);
}

export function CalendarIcon(props) {
  return renderIcon(CalendarDays, props);
}

export function ReportIcon(props) {
  return renderIcon(FileSpreadsheet, props);
}

export function ExpenseIcon(props) {
  return renderIcon(FileSpreadsheet, props);
}

export function SettingsIcon(props) {
  return renderIcon(Settings, props);
}

export function CheckCircleIcon(props) {
  return renderIcon(CheckCircle2, props);
}

export function PauseCircleIcon(props) {
  return renderIcon(PauseCircle, props);
}

export function PulseIcon(props) {
  return renderIcon(Activity, props);
}

export function ChevronRightIcon(props) {
  return renderIcon(ChevronRight, props);
}

export function SpinnerIcon(props) {
  return renderIcon(LoaderCircle, props);
}

export function EyeIcon(props) {
  return renderIcon(Eye, props);
}

export function EyeOffIcon(props) {
  return renderIcon(EyeOff, props);
}
