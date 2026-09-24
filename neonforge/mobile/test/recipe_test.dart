import 'package:flutter_test/flutter_test.dart';
import 'package:neonforge/recipe.dart';

void main() {
  test('EditStep.create copies defaults', () {
    final a = EditStep.create('enhance');
    final b = EditStep.create('enhance');
    a.params['strength'] = 5;
    expect(b.params['strength'], 70);
  });

  test('toJson only sends known params and drops nulls', () {
    final s = EditStep('background', {'mode': 'remove', 'bogus': 1, 'color': null});
    expect(s.toJson()['params'], {'mode': 'remove'});
  });

  test('buildRecipe keeps order and optional output', () {
    final r = buildRecipe([EditStep.create('hdr'), EditStep.create('upscale')], output: {'image_format': 'png'});
    expect((r['steps'] as List).map((s) => s['op']), ['hdr', 'upscale']);
    expect(r['output'], {'image_format': 'png'});
    expect(buildRecipe([]).containsKey('output'), isFalse);
  });

  test('stabilize is video-only; plan resolution caps', () {
    expect(appliesTo('stabilize', 'image'), isFalse);
    expect(appliesTo('stabilize', 'gif'), isTrue);
    expect(resolutionAllowed('4k', 'fhd'), isFalse);
    expect(resolutionAllowed('original', 'sd'), isTrue);
  });

  test('summaries', () {
    expect(EditStep('upscale', {'scale': 4, 'model': 'auto'}).summary, 'Upscale 4x');
    expect(formatBytes(1536), '2 KB');
  });
}
