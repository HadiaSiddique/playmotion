import React, { useEffect, StrictMode } from 'react';
import { NavigationContainer, DarkTheme, getPathFromState, LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './types';

const TITLES: Record<string, string> = { Onboarding: 'Welcome', Pairing: 'Connect a camera', Checkin: 'Check-in', Session: 'Workout', Report: 'Weekly report' };
import { Platform } from 'react-native';
import { MenuProvider } from '../components/MenuContext';
import { GoBackConfiguration } from '../app/remote-control/GoBackConfiguration';
import RootNavigator from './RootNavigator';
import { PairingProvider } from '../movewell/PairingContext';
import { UserProvider } from '../movewell/UserContext';
import MealTipToast from '../movewell/MealTipToast';
import { LaptopCameraPanel } from '../movewell/LaptopCamera';
import DemoGallery from '../movewell/DemoGallery';

/**
 * Browser addresses for each screen (web only), so Back / Forward / refresh work like a normal website.
 * Params such as a session's move list stay in memory, never in the address: a refreshed /play page
 * goes back home instead of guessing moves (they come from the check-in's safety rules).
 */
const linking: LinkingOptions<RootStackParamList> | undefined =
  Platform.OS === 'web'
    ? {
        prefixes: [],
        config: {
          screens: {
            Home: '',
            Onboarding: 'welcome',
            Pairing: 'connect',
            Checkin: 'check-in',
            Session: 'play/:game',
            Report: 'report',
          },
        },
        getPathFromState: (state, options) => getPathFromState(state, options).split('?')[0],
      }
    : undefined;

export interface AppNavigatorProps {
  fontsLoaded?: boolean;
  onReady?: () => void;
}

export default function AppNavigator({ fontsLoaded = true, onReady }: AppNavigatorProps) {
  useEffect(() => {
    // Import remote control config for TV platforms
    if (Platform.isTV) {
      try {
        require('../app/configureRemoteControl');
      } catch (error) {
        console.warn('Remote control configuration not available:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded && onReady) {
      onReady();
    }
  }, [fontsLoaded, onReady]);

  if (!fontsLoaded) {
    return null;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search.includes('demo-gallery')) {
    return <DemoGallery />;
  }

  return (
    <StrictMode>
      <NavigationContainer theme={DarkTheme} linking={linking} documentTitle={{ formatter: (_, route) => `PlayMotion${route?.name && route.name !== 'Home' ? ` · ${TITLES[route.name] ?? route.name}` : ''}` }}>
        <MenuProvider>
          <PairingProvider>
            <UserProvider>
              <GoBackConfiguration />
              <RootNavigator />
              <MealTipToast />
              <LaptopCameraPanel />
            </UserProvider>
          </PairingProvider>
        </MenuProvider>
      </NavigationContainer>
    </StrictMode>
  );
}
