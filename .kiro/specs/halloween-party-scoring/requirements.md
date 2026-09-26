# Requirements Document

## Introduction

The Halloween Party Scoring app is a single-page web application that runs entirely in a browser and is displayed on a big-screen TV during a Halloween party. The host manually enters point values for four teams across six party games. The app maintains a live running total for each team, persists all scores locally so a page refresh does not lose data, and presents everything in a spooky, high-contrast visual theme matching the party invite. There is no backend, no accounts, and a single user (the host) operating the app.

## Glossary

- **App**: The single-page Halloween party scoring web application running in the browser.
- **Host**: The single user operating the App during the party.
- **Team**: One of four competing groups, identified by default as Team A, Team B, Team C, and Team D.
- **Team_Name**: The display label for a Team, either a Host-entered custom name or the default label ("Team A".."Team D").
- **Game**: One of six scored party activities (ABCD Names, Bone Finder, Ghost Catcher, Pumpkin Toss, Quiet Place, Human Centipede).
- **Score_Cell**: A numeric input where the Host enters the point value for one Team in one Game.
- **Game_Score**: The point value entered for one Team in one Game.
- **Team_Total**: The sum of all Game_Scores for a single Team across all Games.
- **Score_Grid**: The visual grid displaying all Teams, all Games, and all Team_Totals.
- **Matchup_Announcement**: A dismissible on-screen overlay that prominently displays a Game's matchup text using current Team_Names, sized for room-wide readability.
- **Local_Store**: The browser localStorage mechanism used to persist scores and Team_Names on the Host's device.
- **Theme**: The visual style (colors, fonts, icons, animations) matching the party invite.

## Requirements

### Requirement 1: Fixed Teams and Games

**User Story:** As the Host, I want the four teams and six games predefined, so that I can start scoring immediately without setup.

#### Acceptance Criteria

1. WHEN the App loads, THE App SHALL display exactly four Teams labeled "Team A", "Team B", "Team C", and "Team D".
2. WHEN the App loads, THE App SHALL display exactly six Games in the following order: "ABCD Names", "Bone Finder", "Ghost Catcher", "Pumpkin Toss", "Quiet Place", and "Human Centipede".
3. WHERE a Game has a defined matchup, THE App SHALL display the matchup for that Game as follows: Ghost Catcher as "Team A vs Team B & Team C vs Team D", Pumpkin Toss as "Team A vs Team C & Team B vs Team D", and Quiet Place as "Team A vs Team D & Team B vs Team C".
4. WHERE a Game has no defined matchup, THE App SHALL display that Game without any matchup text.
5. THE App SHALL display the predefined Teams and Games without requiring any Host configuration, setup, or data entry.

### Requirement 2: Manual Score Entry

**User Story:** As the Host, I want to type a point value for each team in each game, so that I can record results as games finish.

#### Acceptance Criteria

1. THE App SHALL provide one Score_Cell for each combination of Team and Game.
2. WHEN the Host enters an integer value between -999 and 999 inclusive into a Score_Cell, THE App SHALL store that value as the Game_Score for that Team and Game.
3. WHERE a Game_Score has not been entered, THE App SHALL treat the Game_Score as zero for total calculation.
4. WHERE the Game is "Quiet Place", THE App SHALL accept negative Game_Score values between -999 and 999 inclusive.
5. IF the Game is not "Quiet Place" AND the Host enters a Game_Score below zero, THEN THE App SHALL reject the value, retain the previous Game_Score for that Team and Game, and display an error indication identifying the affected Score_Cell.
6. IF the Host enters a non-integer or non-numeric value into a Score_Cell, THEN THE App SHALL reject the value, retain the previous Game_Score for that Team and Game, and display an error indication identifying the affected Score_Cell.

### Requirement 3: Live Running Totals

**User Story:** As the Host, I want each team's total to update as I enter points, so that everyone can see the standings in real time.

#### Acceptance Criteria

1. THE App SHALL display a Team_Total for each Team.
2. WHEN a Game_Score is entered or changed, THE App SHALL recalculate the affected Team_Total as the sum of that Team's Game_Scores across all six Games.
3. WHERE a Game has no Game_Score entered for a Team, THE App SHALL treat that missing Game_Score as zero when calculating the Team_Total.
4. THE App SHALL display each recalculated Team_Total within 200ms of a Game_Score change.
5. THE App SHALL render each Team_Total in a persistently visible location that remains on screen without requiring the Host to scroll.
6. WHEN a Game_Score is entered or changed, THE App SHALL update the visible Team_Total for the affected Team without the Host navigating away from or scrolling the Score_Grid.
7. WHERE a Team_Total is negative, THE App SHALL display the Team_Total with a leading minus sign.
8. IF an entered Game_Score is non-numeric or outside the range -999 to 999, THEN THE App SHALL reject the entry, leave the affected Team_Total unchanged, and display an error indication identifying the invalid entry.

### Requirement 4: Score Grid Display

**User Story:** As the Host, I want a grid showing all teams and games together, so that I can see and manage the whole competition on one screen.

#### Acceptance Criteria

1. THE App SHALL display a Score_Grid containing all four Teams, all six Games, and each Team_Total.
2. THE App SHALL arrange the Score_Grid with one row per Team, producing exactly four Team rows.
3. THE App SHALL arrange the Score_Grid with one column per Game, producing exactly six Game columns, ordered as defined in Requirement 1.
4. THE App SHALL display a rightmost Total column positioned at the right end of every Team row.
5. THE App SHALL display each Team's Team_Total as a prominent cell in the Total column at the right end of that Team's row.
6. THE App SHALL position each Score_Cell at the intersection of its Team row and its Game column such that the Team and Game corresponding to each Score_Cell are both identifiable from the Score_Grid layout.
7. WHERE a Game has a defined matchup, THE App SHALL associate that Game's matchup information with the Game's column.
8. THE App SHALL display the entire Score_Grid on a single screen without requiring the Host to navigate to a separate page.
9. WHEN a Score_Cell has no score entered, THE App SHALL display that Score_Cell as empty.
10. WHEN a score is entered or changed for any Score_Cell, THE App SHALL update the corresponding Team_Total in that Team's Total column to equal the sum of that Team's six Game scores.
11. IF the Score_Grid cannot fit within the visible screen area, THEN THE App SHALL keep the Team labels, Game labels, and the Total column visible while the Host scrolls the Score_Cells.

### Requirement 5: Local Persistence

**User Story:** As the Host, I want scores saved on the device, so that refreshing or reopening the page does not lose the game results.

#### Acceptance Criteria

1. WHEN a Game_Score is entered or changed, THE App SHALL write all current Game_Scores and all current Team_Names to the Local_Store within 1 second of the change.
2. WHEN a Team_Name is entered or changed, THE App SHALL write all current Team_Names and all current Game_Scores to the Local_Store within 1 second of the change.
3. IF writing to the Local_Store fails, THEN THE App SHALL retain the current Game_Scores and Team_Names in the Score_Grid, display an error message indicating that data could not be saved, and continue operation.
4. WHEN the App loads and the Local_Store contains saved Game_Scores or Team_Names, THE App SHALL read those values from the Local_Store and populate the Score_Grid with the stored Game_Scores and Team_Names.
5. IF the Local_Store contains no saved Game_Scores when the App loads, THEN THE App SHALL initialize every Game_Score to zero.
6. IF the Local_Store contains no saved Team_Names when the App loads, THEN THE App SHALL display the default Team labels ("Team A".."Team D").
7. IF reading from the Local_Store fails when the App loads, THEN THE App SHALL initialize every Game_Score to zero, display the default Team labels, display an error message indicating that saved data could not be loaded, and continue operation.
8. IF the Local_Store contains data that cannot be parsed into valid values, THEN THE App SHALL initialize every Game_Score to zero, display the default Team labels, display an error message indicating that saved data was invalid, and continue operation.

### Requirement 6: Reset Scores

**User Story:** As the Host, I want to clear all scores, so that I can reuse the app for a future party.

#### Acceptance Criteria

1. WHEN the Host activates the reset control, THE App SHALL display a confirmation prompt presenting a confirm action and a cancel action, and SHALL NOT modify any Game_Score until the Host selects an action.
2. WHEN the Host selects the confirm action, THE App SHALL set every Game_Score to zero and remove all saved Game_Scores from the Local_Store within 2 seconds.
3. WHEN the Host selects the cancel action, THE App SHALL dismiss the confirmation prompt and retain every current Game_Score and every saved Game_Score in the Local_Store unchanged.
4. WHEN the Host selects the confirm action, THE App SHALL retain every current Team_Name and every saved Team_Name in the Local_Store unchanged.
5. IF the App fails to clear the saved Game_Scores from the Local_Store during a confirmed reset, THEN THE App SHALL retain the prior saved Game_Scores unchanged and display an error message indicating the reset did not complete.

### Requirement 7: Party Visual Theme

**User Story:** As the Host, I want the app styled to match the party invite, so that the scoreboard fits the party atmosphere.

#### Acceptance Criteria

1. THE App SHALL render the page background using the near-black color #0d0d0d across the full viewport width and height.
2. THE App SHALL render the main title using the neon green color #b5e847 in a blackletter-style display font matching the invite's "HALLOWEEN PARTY" lettering.
3. WHERE the configured title font fails to load, THE App SHALL render the main title in a fallback serif font while preserving the neon green color #b5e847.
4. THE App SHALL apply the accent colors pink #f4a6c8, orange #f08a24, and cream #f5f0e6 to text and decorative elements, with each accent color applied to at least one visible element.
5. THE App SHALL display at least 8 of the following 10 Halloween decorative icons drawn from the invite: black cat, skull, spider web, spider, witch hat, jack-o-lantern, potion bottle, bones, candle, and moth.
6. THE App SHALL maintain a text-to-background contrast ratio of at least 4.5:1 for all body text and at least 3:1 for the main title and other large-scale text.

### Requirement 8: Ambient Animations

**User Story:** As the Host, I want subtle animated decorations, so that the display feels lively without distracting from the scores.

#### Acceptance Criteria

1. THE App SHALL continuously animate at least three decorative elements: a flickering candle, a drifting spider, and twinkling stars.
2. WHILE the display is rendered, THE App SHALL render decorative animations at a minimum of 30 frames per second.
3. THE App SHALL keep all animated motion confined to decorative elements so that Score_Grid and Team_Total values remain fixed in position and do not overlap or move during animation.
4. THE App SHALL constrain the positional displacement of any single decorative element to no more than 15 percent of the viewport width and 15 percent of the viewport height per animation cycle.
5. IF a decorative element's animation cannot be rendered, THEN THE App SHALL continue displaying Score_Grid and Team_Total values without interruption and omit the affected decorative element.

### Requirement 9: Big-Screen Readability

**User Story:** As a party guest, I want to read the scoreboard from across the room, so that I can follow the standings during the party.

#### Acceptance Criteria

1. WHEN the App renders Team labels, Game labels, Score_Cell values, and Team_Total values, THE App SHALL display each of these text elements at a computed font size of at least 24 CSS pixels on viewport widths of 1280 pixels or greater.
2. THE App SHALL maintain a contrast ratio of at least 4.5:1 between all scoring text and its background across all Theme color combinations.
3. WHILE the App is displayed at a viewport width of 1280 pixels or greater, THE App SHALL keep all Team labels, Game labels, Score_Cell values, and Team_Total values fully visible within the viewport without requiring horizontal scrolling and without truncating or clipping any character.
4. IF a Score_Cell value or Team_Total value exceeds the width of its display area, THEN THE App SHALL keep the complete numeric value visible without clipping and without reducing its font size below 24 CSS pixels.

### Requirement 10: Local-Only Single-User Operation

**User Story:** As the Host, I want the app to run without a backend or login, so that I can open it and use it immediately at the party.

#### Acceptance Criteria

1. THE App SHALL execute all scoring logic within the browser and SHALL NOT transmit Game_Scores or any Host-entered data to an external server.
2. THE App SHALL provide full scoring functionality without requiring the Host to create an account, sign in, or provide credentials.
3. WHEN the Host opens the App URL, THE App SHALL load and become ready to accept scoring input within 3 seconds, without any network request to a backend server.
4. WHEN the Host closes and reopens the App within the same browser on the same device, THE App SHALL restore all previously entered Game_Scores from local browser storage.
5. IF local browser storage is unavailable or access to it fails, THEN THE App SHALL continue to provide scoring functionality for the current session and SHALL display a message indicating that scores will not persist after the browser is closed.

### Requirement 11: Editable Team Names

**User Story:** As the Host, I want to replace the default team labels with custom names, so that the scoreboard shows the names the team members chose.

#### Acceptance Criteria

1. THE App SHALL provide an editable field for each Team through which the Host can enter a custom Team_Name.
2. WHEN the Host enters a custom Team_Name, THE App SHALL display that Team_Name as the Team's label in the Score_Grid and everywhere else the Team is referenced, including the Team_Total.
3. WHEN a custom Team_Name is entered or changed, THE App SHALL persist all Team_Names to the Local_Store and restore them on the next App load together with the saved Game_Scores.
4. WHERE a Team has no custom Team_Name, THE App SHALL display the default label for that Team ("Team A".."Team D").
5. IF the Host enters a Team_Name longer than 30 characters, THEN THE App SHALL limit the stored Team_Name to 30 characters.
6. WHERE the Host-entered Team_Name is empty, THE App SHALL display the default label for that Team ("Team A".."Team D").
7. WHEN the Host confirms a score reset, THE App SHALL retain every custom Team_Name unchanged.

### Requirement 12: Matchup Announcement Toggle

**User Story:** As the Host, I want to display a game's matchup prominently on screen, so that guests across the room can see who plays who.

#### Acceptance Criteria

1. WHERE a Game has a defined matchup, THE App SHALL provide a clickable matchup control associated with that Game.
2. WHERE a Game has no defined matchup, THE App SHALL NOT provide a matchup control for that Game.
3. WHEN the Host activates a Game's matchup control, THE App SHALL display a Matchup_Announcement presenting that Game's matchup text in a large, room-readable presentation using the current Team_Names.
4. THE App SHALL render the Matchup_Announcement using the current custom Team_Names where set and the default Team labels otherwise.
5. WHEN the Host activates the same Game's matchup control again or activates a dismiss control, THE App SHALL hide the Matchup_Announcement.
6. WHILE a Matchup_Announcement is displayed, THE App SHALL present it as a dismissible overlay that retains all current Game_Scores and Team_Names when dismissed.
