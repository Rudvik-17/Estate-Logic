import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleProp, ViewStyle } from 'react-native';
import { useRateLimit } from '../hooks/useRateLimit';

interface RateLimitedIconButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  icon: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  limit?: number;
  windowMs?: number;
}

export const RateLimitedIconButton: React.FC<RateLimitedIconButtonProps> = ({
  icon,
  onPress,
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
      {icon}
    </TouchableOpacity>
  );
};

export default RateLimitedIconButton;
