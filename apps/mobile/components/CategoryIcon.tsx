import React from 'react'
import { View } from 'react-native'
import {
  type Icon,
  type IconProps,
  ForkKnifeIcon,
  CarIcon,
  ShoppingBagIcon,
  FilmSlateIcon,
  HeartbeatIcon,
  LightningIcon,
  UsersThreeIcon,
  CoinsIcon,
  ArrowCounterClockwiseIcon,
  HouseIcon,
  TrendUpIcon,
  RepeatIcon,
  ArrowsLeftRightIcon,
  DotsThreeIcon,
  TagIcon,
  GiftIcon,
  AirplaneInFlightIcon,
  GraduationCapIcon,
  CoffeeIcon,
  BarbellIcon,
  BriefcaseIcon,
  MusicNotesIcon,
  GameControllerIcon,
  PillIcon,
  UmbrellaIcon,
  DogIcon,
  BookOpenIcon,
  PhoneIcon,
  GlobeIcon,
  LeafIcon,
  WrenchIcon,
  ReceiptIcon,
  TrophyIcon,
  StarIcon,
  PiggyBankIcon,
  GasCanIcon,
  ScissorsIcon,
  StorefrontIcon,
  BabyIcon,
  TicketIcon,
} from 'phosphor-react-native'
import { CATEGORY_METADATA, DEFAULT_CATEGORY_ICON } from '../lib/categoryMetadata'
import { categoryColor } from '@paisa-buddy/shared/categories'

const ICON_MAP: Record<string, React.FC<IconProps>> = {
  ForkKnifeIcon,
  CarIcon,
  ShoppingBagIcon,
  FilmSlateIcon,
  HeartbeatIcon,
  LightningIcon,
  UsersThreeIcon,
  CoinsIcon,
  ArrowCounterClockwiseIcon,
  HouseIcon,
  TrendUpIcon,
  RepeatIcon,
  ArrowsLeftRightIcon,
  DotsThreeIcon,
  TagIcon,
  GiftIcon,
  AirplaneInFlightIcon,
  GraduationCapIcon,
  CoffeeIcon,
  BarbellIcon,
  BriefcaseIcon,
  MusicNotesIcon,
  GameControllerIcon,
  PillIcon,
  UmbrellaIcon,
  DogIcon,
  BookOpenIcon,
  PhoneIcon,
  GlobeIcon,
  LeafIcon,
  WrenchIcon,
  ReceiptIcon,
  TrophyIcon,
  StarIcon,
  PiggyBankIcon,
  GasCanIcon,
  ScissorsIcon,
  StorefrontIcon,
  BabyIcon,
  TicketIcon,
}

type Props = {
  category?: string | null
  colorMap?: Record<string, string>
  forceIconName?: string | null
  forceBgColor?: string
  size?: number
  circleSize?: number
  iconColor?: string
}

export { ICON_MAP }

export function CategoryIcon({
  category,
  colorMap,
  forceIconName,
  forceBgColor,
  size = 20,
  circleSize = 36,
  iconColor = '#fff',
}: Props) {
  const meta = category ? CATEGORY_METADATA[category] : null
  const iconName = forceIconName ?? meta?.icon ?? DEFAULT_CATEGORY_ICON
  const bgColor = forceBgColor ?? categoryColor(category, colorMap)
  const IconComponent = ICON_MAP[iconName] ?? TagIcon

  return (
    <View
      style={{
        width: circleSize,
        height: circleSize,
        borderRadius: circleSize / 2,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <IconComponent size={size} weight="fill" color={iconColor} />
    </View>
  )
}
