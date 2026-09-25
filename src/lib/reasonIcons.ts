import {
  ArrowFatLineDownIcon,
  BugIcon,
  ChatTextIcon,
  CookingPotIcon,
  FireIcon,
  HourglassIcon,
  TruckIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { Reason } from '../types'

/** One picture per reason, so the buttons can be found without reading. */
export const REASON_ICON: Record<Reason, Icon> = {
  made_too_much: CookingPotIcon,
  expired: HourglassIcon,
  spoiled: BugIcon,
  mistake: FireIcon,
  dropped: ArrowFatLineDownIcon,
  supplier_quality: TruckIcon,
  other: ChatTextIcon,
}
