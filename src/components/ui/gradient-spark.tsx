import { useState } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { SparkleGradient } from '@/constants/theme';

type Props = {
  size?: number;
};

// Material Symbols' "auto_awesome" glyph (Apache-licensed, same shape Gemini itself uses)
// filled with Gemini's signature blue -> violet -> coral gradient instead of a flat tint.
const SPARK_PATH =
  'M19 9l-1.25-2.75L15 5l2.75-1.25L19 1l1.25 2.75L23 5l-2.75 1.25L19 9zM19 23l-1.25-2.75L15 19l2.75-1.25L19 15l1.25 2.75L23 19l-2.75 1.25L19 23zM9 20l-1.9-4.1L3 14l4.1-1.9L9 8l1.9 4.1L15 14l-4.1 1.9L9 20z';

export function GradientSpark({ size = 20 }: Props) {
  const [gradientId] = useState(() => `spark-gradient-${Math.random().toString(36).slice(2)}`);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          {SparkleGradient.map((color, i) => (
            <Stop key={color} offset={`${(i / (SparkleGradient.length - 1)) * 100}%`} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Path fill={`url(#${gradientId})`} d={SPARK_PATH} />
    </Svg>
  );
}
