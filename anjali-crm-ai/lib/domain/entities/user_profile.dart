import 'sync_entity.dart';

/// Anjali's own profile (stored in the settings box).
class UserProfile {
  const UserProfile({required this.name, required this.mobile, this.photoPath});

  final String name;
  final String mobile;
  final String? photoPath;

  String get firstName => name.trim().split(RegExp(r'\s+')).first;

  UserProfile copyWith({String? name, String? mobile, Object? photoPath = _unset}) => UserProfile(
        name: name ?? this.name,
        mobile: mobile ?? this.mobile,
        photoPath: identical(photoPath, _unset) ? this.photoPath : photoPath as String?,
      );
  static const _unset = Object();

  Map<String, dynamic> toMap() => {'name': name, 'mobile': mobile, 'photoPath': photoPath};

  factory UserProfile.fromMap(Map m) => UserProfile(
        name: MapRead.str(m, 'name', 'Anjali'),
        mobile: MapRead.str(m, 'mobile'),
        photoPath: MapRead.strOrNull(m, 'photoPath'),
      );

  static const fallback = UserProfile(name: 'Anjali', mobile: '');
}
