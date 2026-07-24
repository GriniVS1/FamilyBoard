// Regression test for `resolveInitialStep` — app-first onboarding must skip
// whatever the wall's own status snapshot already reports as done, and must
// probe weather BEFORE pin (see the doc comment on `WizardStep` for why:
// `getSetupStatus().setupComplete` doesn't require `weatherSet`, so a wizard
// that set the PIN first would immediately lock itself out of
// `POST /api/setup/weather`).

import 'package:familyboard_mobile/models/setup_status.dart';
import 'package:familyboard_mobile/state/setup_onboarding_controller.dart';
import 'package:flutter_test/flutter_test.dart';

SetupStatus _status({
  bool familyCreated = false,
  int memberCount = 0,
  bool pinSet = false,
  bool weatherSet = false,
  bool setupComplete = false,
}) {
  return SetupStatus(
    installationId: 'inst_1',
    localeChosen: true,
    familyCreated: familyCreated,
    memberCount: memberCount,
    pinSet: pinSet,
    weatherSet: weatherSet,
    setupComplete: setupComplete,
  );
}

void main() {
  test('a brand-new board starts at family', () {
    expect(resolveInitialStep(_status()), equals(WizardStep.family));
  });

  test('skips family once created, resumes at members', () {
    expect(
      resolveInitialStep(_status(familyCreated: true)),
      equals(WizardStep.members),
    );
  });

  test('skips family + members, resumes at weather (not pin)', () {
    expect(
      resolveInitialStep(_status(familyCreated: true, memberCount: 2)),
      equals(WizardStep.weather),
    );
  });

  test('skips family + members + weather, resumes at pin', () {
    expect(
      resolveInitialStep(
        _status(familyCreated: true, memberCount: 2, weatherSet: true),
      ),
      equals(WizardStep.pin),
    );
  });

  test(
    'skips family + members + weather + pin, resumes at whoAreYou '
    '(this state is never actually reachable in practice — pinSet true '
    'implies setupComplete true, which the controller checks first — but '
    'resolveInitialStep itself must still degrade gracefully)',
    () {
      expect(
        resolveInitialStep(
          _status(
            familyCreated: true,
            memberCount: 2,
            weatherSet: true,
            pinSet: true,
          ),
        ),
        equals(WizardStep.whoAreYou),
      );
    },
  );

  test('memberCount 0 means members is not done even if familyCreated', () {
    expect(
      resolveInitialStep(_status(familyCreated: true, memberCount: 0)),
      equals(WizardStep.members),
    );
  });
}
