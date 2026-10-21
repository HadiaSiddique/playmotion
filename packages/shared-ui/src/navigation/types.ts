export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Pairing: undefined;
  // game/moves: what the person picked themselves (kept after the check-in, which still screens mood and pain)
  Checkin: { game?: string; moves?: { id: string; target: number }[] } | undefined;
  Report: undefined;
  Session: { game: string; moves: { id: string; target: number }[]; moodBefore?: number; energyBefore?: number };
  DrawerNavigator: undefined;
  Details: {
    title: string;
    description: string;
    headerImage: string;
    movie: string;
    category?: string;
    genres?: string[];
    releaseYear?: number;
    rating?: number;
    ratingCount?: number;
    contentRating?: string;
    duration?: number;
  };
  Player: {
    movie: string;
    headerImage: string;
  };
};

export type DrawerParamList = {
  Home: undefined;
  Explore: undefined;
  TV: undefined;
  Settings: undefined;
};
