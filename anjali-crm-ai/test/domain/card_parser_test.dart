import 'package:anjali_crm_ai/domain/services/business_card_parser.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('extracts name, phones, email, company and title from a typical card', () {
    const text = '''
OMAR HADDAD
Senior Sales Manager
Gulf Trading LLC
Mob: +971 50 123 4567
Tel: 04 333 2222
Fax: 04 333 2223
omar.haddad@gulftrading.ae
www.gulftrading.ae
''';
    final c = BusinessCardParser.parse(text);
    expect(c.name, 'Omar Haddad');
    expect(c.jobTitle, 'Senior Sales Manager');
    expect(c.company, 'Gulf Trading LLC');
    expect(c.email, 'omar.haddad@gulftrading.ae');
    expect(c.phones, ['+971501234567', '043332222']);
    expect(c.website, 'www.gulftrading.ae');
  });

  test('empty text yields an empty card', () {
    expect(BusinessCardParser.parse('').isEmpty, isTrue);
  });
}
