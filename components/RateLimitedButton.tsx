import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleProp, ViewStyle } from 'react-native';
import { useRateLimit } from '../hooks/useRateLimit';

interface RateLimitedButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  limit?: number;
  windowMs?: number;
}

export const RateLimitedButton: React.FC<RateLimitedButtonProps> = ({
  onPress,
  children,
  style,
  limit,
  windowMs,
  ...rest
}) => {
  const { isLimited, tryAction } = useRateLimit(limit, windowMs);

  const handlePress = () => {
    if (onPress) {
      tryAction(onPress);
    }
  };

  return (
    <TouchableOpacity
      {...rest}
      onPress={handlePress}
      style={[style, { opacity: isLimited ? 0.4 : 1 }]}
      disabled={rest.disabled}
    >
      {children}
    </TouchableOpacity>
  );
};

export default RateLimitedButton;
