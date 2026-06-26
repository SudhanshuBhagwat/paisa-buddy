import React, { useEffect, useState } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

type AnimatedAmountProps = {
  amount: number
  style?: StyleProp<TextStyle>
  duration?: number
  formatter?: (amount: number) => string
  numberOfLines?: number
}

const currencyNoDecimals = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatAmountWithoutDecimals(paise: number): string {
  return currencyNoDecimals.format(paise / 100)
}

export function AnimatedAmount({
  amount,
  style,
  duration = 700,
  formatter = formatAmountWithoutDecimals,
  numberOfLines,
}: AnimatedAmountProps) {
  const animatedAmount = useSharedValue(0)
  const [displayAmount, setDisplayAmount] = useState(0)

  useEffect(() => {
    setDisplayAmount(0)
    animatedAmount.value = 0
    animatedAmount.value = withTiming(amount, { duration })
  }, [amount, animatedAmount, duration])

  useAnimatedReaction(
    () => Math.round(animatedAmount.value),
    (value, previousValue) => {
      if (value !== previousValue) {
        runOnJS(setDisplayAmount)(value)
      }
    },
    [],
  )

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {formatter(displayAmount)}
    </Text>
  )
}
