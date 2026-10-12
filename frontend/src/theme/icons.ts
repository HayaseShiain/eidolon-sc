// 界面上的图标统一用 Lucide，以语义别名导出，不手绘 SVG（DESIGN.md「The Library Icon Rule」；品牌标志是例外，见文件末尾）。
export {
  ArrowRightLeft as MicSwitchIcon,
  ChevronDown as CollapseIcon,
  ChevronLeft as BackIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Phone as PhoneIcon,
  PhoneOff as HangUpIcon,
  Shirt as OutfitIcon,
} from "lucide-react";

// 记忆页、设置页用的图标（ticket 06）。
export { Trash2 as TrashIcon } from "lucide-react";

// 后台导航用的图标。
export {
  LayoutDashboard as DashboardIcon,
  Megaphone as AnnouncementsIcon,
  SlidersHorizontal as ConfigIcon,
  Users as UsersIcon,
} from "lucide-react";

// 发送键和更多菜单。
export { ArrowUp as SendIcon, Ellipsis as MoreIcon } from "lucide-react";

// 失败提示（components/app/FailureNotice）。
export { CircleAlert as FailureIcon } from "lucide-react";

// 设置页「已绑定」的提示和它的关闭键（shadcn-redesign 18）。
export { CircleCheck as SuccessIcon, X as CloseIcon } from "lucide-react";

// 对话列表页首的公告铃铛（GLOSSARY.md「公告」）；后台导航的公告用 Megaphone。
export { Bell as AnnouncementsBellIcon } from "lucide-react";

// 对话列表的搜索框；通话条右端「回到通话 ›」的箭头。
export { ChevronRight as ForwardIcon, Search as SearchIcon } from "lucide-react";

// 对话列表搜索框右边的筛选按钮；置顶那一行的图钉。
export { ListFilter as FilterIcon, Pin as PinIcon } from "lucide-react";

// 后台用户列表可以排序的表头：按它从多到少排着的，和还没按它排的（shadcn-redesign 22）。
export { ArrowDown as SortedIcon, ArrowUpDown as SortableIcon } from "lucide-react";

// 通话层右上角的「只看文字」胶囊。
export { Captions as TextOnlyIcon } from "lucide-react";

// PROTOTYPE（票 12「原型：应用导航外壳」）：导航栏和 dock、设置一级页面的图标。
export {
  BookHeart as MemoriesIcon,
  CircleUser as ProfileIcon,
  Gift as GiftIcon,
  Info as AboutIcon,
  KeyRound as OwnKeysIcon,
  LogIn as SignInIcon,
  MessageCircle as ConversationsIcon,
  PanelLeft as SidebarToggleIcon,
  Settings as SettingsIcon,
} from "lucide-react";

// PROTOTYPE（票 14「原型：礼物页」）：档位心形、冷却沙漏、抽奖、重置卡，以及还没出图的礼物的占位。
export {
  CakeSlice as FoodIcon,
  CupSoda as DrinkIcon,
  Flower2 as FlowerIcon,
  Heart as HeartIcon,
  HeartCrack as HeartCrackIcon,
  HeartOff as HeartOffIcon,
  Hourglass as CooldownIcon,
  Package as TrinketIcon,
  Sparkles as DrawIcon,
  TicketCheck as ResetCardIcon,
} from "lucide-react";

// 对话列表页首的 GitHub 仓库链接；品牌标志 Lucide 不收，是 The Library Icon Rule 的例外。
export { GitHubIcon } from "./GitHubIcon";

// PROTOTYPE（票 13「原型：像手机设置那样的一级、二级设置页面」）：设置列表里新出现的几个图标。
export {
  AudioLines as TtsIcon,
  Bot as LlmIcon,
  Check as CheckIcon,
  ExternalLink as ExternalLinkIcon,
  FileText as TermsIcon,
  LogOut as SignOutIcon,
  Shield as PrivacyIcon,
} from "lucide-react";
