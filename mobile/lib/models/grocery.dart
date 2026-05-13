/// POD models for the grocery list endpoints.
library;

/// The 8 backend category values plus [GroceryCategory.uncategorized]
/// for items where [GroceryItem.category] is null.
enum GroceryCategory {
  produce,
  dairy,
  pantry,
  frozen,
  bakery,
  meat,
  drinks,
  other,

  /// Sentinel for items whose category field is null on the server.
  uncategorized;

  /// Parse a nullable raw string from JSON into a [GroceryCategory].
  static GroceryCategory fromRaw(Object? raw) {
    if (raw is! String) {
      return GroceryCategory.uncategorized;
    }
    return GroceryCategory.values.firstWhere(
      (GroceryCategory c) => c.name == raw,
      orElse: () => GroceryCategory.other,
    );
  }
}

class GroceryItem {
  const GroceryItem({
    required this.id,
    required this.familyId,
    required this.name,
    required this.quantity,
    required this.unit,
    required this.category,
    required this.checked,
    required this.source,
    required this.order,
    required this.createdAt,
    required this.updatedAt,
  });

  factory GroceryItem.fromJson(Map<String, Object?> json) {
    return GroceryItem(
      id: json['id']! as String,
      familyId: json['familyId']! as String,
      name: json['name']! as String,
      // quantity is a free-form string on the backend ("2", "500", "1 pack")
      quantity: json['quantity'] is String ? json['quantity']! as String : null,
      unit: json['unit'] is String ? json['unit']! as String : null,
      category: GroceryCategory.fromRaw(json['category']),
      checked: json['checked'] == true,
      source: json['source'] is String ? json['source']! as String : null,
      order: json['order'] is int ? json['order']! as int : 0,
      createdAt: json['createdAt'] is String
          ? DateTime.parse(json['createdAt']! as String)
          : DateTime.now(),
      updatedAt: json['updatedAt'] is String
          ? DateTime.parse(json['updatedAt']! as String)
          : DateTime.now(),
    );
  }

  final String id;
  final String familyId;
  final String name;
  final String? quantity;
  final String? unit;
  final GroceryCategory category;
  final bool checked;
  final String? source;
  final int order;
  final DateTime createdAt;
  final DateTime updatedAt;

  GroceryItem copyWith({bool? checked}) {
    return GroceryItem(
      id: id,
      familyId: familyId,
      name: name,
      quantity: quantity,
      unit: unit,
      category: category,
      checked: checked ?? this.checked,
      source: source,
      order: order,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }

  /// Display label: "2 kg Flour", "Milk", "1 pack Eggs" etc.
  String get displayLabel {
    final StringBuffer buf = StringBuffer();
    if (quantity != null && quantity!.isNotEmpty) {
      buf.write(quantity);
      if (unit != null && unit!.isNotEmpty) {
        buf.write(' ');
        buf.write(unit);
      }
      buf.write(' ');
    } else if (unit != null && unit!.isNotEmpty) {
      buf.write(unit);
      buf.write(' ');
    }
    buf.write(name);
    return buf.toString().trim();
  }
}
