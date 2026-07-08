// Regression test for the `displayName` vs `name` field-name drift between
// the wall's `/api/mobile/calendar/connect-caldav` response and the mobile
// `CaldavCalendarOption` model.

import 'package:familyboard_mobile/models/calendar_setup.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('CaldavCalendarOption.fromJson reads displayName from the API', () {
    final CaldavCalendarOption option = CaldavCalendarOption.fromJson(
      const <String, Object?>{
        'url': 'https://caldav.example.com/cal/1',
        'displayName': 'Family Calendar',
        'ctag': 'abc123',
        'color': '#ff0000',
      },
    );

    expect(option.url, equals('https://caldav.example.com/cal/1'));
    expect(option.name, equals('Family Calendar'));
  });
}
