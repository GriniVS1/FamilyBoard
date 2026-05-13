library;

enum MealSlot {
  breakfast,
  lunch,
  dinner,
  snack;

  static MealSlot fromRaw(String raw) {
    return MealSlot.values.firstWhere(
      (MealSlot s) => s.name.toUpperCase() == raw.toUpperCase(),
      orElse: () => MealSlot.breakfast,
    );
  }
}

class MealPlanRecipe {
  const MealPlanRecipe({
    required this.id,
    required this.name,
    required this.imageUrl,
  });

  factory MealPlanRecipe.fromJson(Map<String, Object?> json) {
    return MealPlanRecipe(
      id: json['id']! as String,
      name: json['name']! as String,
      imageUrl: json['imageUrl'] is String ? json['imageUrl']! as String : null,
    );
  }

  final String id;
  final String name;
  final String? imageUrl;
}

class MealPlanMember {
  const MealPlanMember({
    required this.id,
    required this.name,
    required this.color,
  });

  factory MealPlanMember.fromJson(Map<String, Object?> json) {
    return MealPlanMember(
      id: json['id']! as String,
      name: json['name']! as String,
      color: json['color']! as String,
    );
  }

  final String id;
  final String name;
  final String color;
}

class MealPlan {
  const MealPlan({
    required this.id,
    required this.date,
    required this.slot,
    required this.customName,
    required this.notes,
    required this.recipe,
    required this.member,
  });

  factory MealPlan.fromJson(Map<String, Object?> json) {
    final Object? recipeRaw = json['recipe'];
    final Object? memberRaw = json['member'];
    return MealPlan(
      id: json['id']! as String,
      date: DateTime.parse(json['date']! as String),
      slot: MealSlot.fromRaw(json['slot']! as String),
      customName:
          json['customName'] is String ? json['customName']! as String : null,
      notes: json['notes'] is String ? json['notes']! as String : null,
      recipe: recipeRaw is Map
          ? MealPlanRecipe.fromJson(
              (recipeRaw as Map<Object?, Object?>).cast<String, Object?>())
          : null,
      member: memberRaw is Map
          ? MealPlanMember.fromJson(
              (memberRaw as Map<Object?, Object?>).cast<String, Object?>())
          : null,
    );
  }

  final String id;
  final DateTime date;
  final MealSlot slot;
  final String? customName;
  final String? notes;
  final MealPlanRecipe? recipe;
  final MealPlanMember? member;

  String get displayName => recipe?.name ?? customName ?? '';
}
