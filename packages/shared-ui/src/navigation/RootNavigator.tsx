import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { RootStackParamList } from './types';
import DrawerNavigator from './DrawerNavigator';
import DetailsScreen from '../screens/DetailsScreen';
import PlayerScreen from '../screens/PlayerScreen';
import CheckinScreen from '../movewell/CheckinScreen';
import HomeScreen from '../movewell/HomeScreen';
import OnboardingScreen from '../movewell/OnboardingScreen';
import PairingScreen from '../movewell/PairingScreen';
import ReportScreen from '../movewell/ReportScreen';
import SessionScreen from '../movewell/SessionScreen';
import { Loading } from '../movewell/ui';
import { useUser } from '../movewell/UserContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { loading, userId } = useUser();
  // TV: wait for the saved user before choosing the first screen (Home for returning users, onboarding
  // otherwise). Browser: mount straight away so the address bar decides (/report stays /report on refresh);
  // Home sends people without a profile to onboarding.
  if (loading && Platform.OS !== 'web') return <Loading text="Starting PlayMotion…" />;

  return (
    <Stack.Navigator
      initialRouteName={userId ? 'Home' : 'Onboarding'}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Pairing" component={PairingScreen} />
      <Stack.Screen name="Checkin" component={CheckinScreen} />
      <Stack.Screen name="Session" component={SessionScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      {/* Screens from the Amazon sample, kept for reference. */}
      <Stack.Screen name="DrawerNavigator" component={DrawerNavigator} />
      <Stack.Screen name="Details" component={DetailsScreen} />
      <Stack.Screen name="Player" component={PlayerScreen} />
    </Stack.Navigator>
  );
}
