// react-native-web's Alert.alert does nothing; the browser's dialog has fixed OK/Cancel buttons.
export function confirm(title: string, message: string, _action: string): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
