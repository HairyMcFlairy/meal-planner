import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const STORAGE_KEY = "meal-planner-local-fallback";

const ICON_OPTIONS = {
  pot: "🍲",
  apple: "🍎",
  carrot: "🥕",
  salad: "🥗",
  wheat: "🌾",
  milk: "🥛",
  cup: "🥤",
  beef: "🥩",
  chicken: "🍗",
  fish: "🐟",
  egg: "🥚",
  sweet: "🍬",
  snack: "🥪",
};

function normaliseName(value) {
  return value.trim().toLowerCase();
}

function formatQuantity(quantity) {
  const num = Number(quantity || 0);
  if (Number.isInteger(num)) return String(num);
  return String(Number(num.toFixed(2)));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(Number(value || 0));
}

function formatCalories(value) {
  return `${Math.round(Number(value || 0))} cal`;
}

function guessIconKey(name) {
  const value = name.trim().toLowerCase();

  if (["milk", "cheese", "yoghurt", "butter"].some((item) => value.includes(item))) return "milk";
  if (["juice", "water", "sauce", "soy", "drink"].some((item) => value.includes(item))) return "cup";
  if (["apple", "banana", "tomato", "avocado", "fruit", "berry"].some((item) => value.includes(item))) return "apple";
  if (["carrot", "onion", "broccoli", "potato", "vegetable", "pepper"].some((item) => value.includes(item))) return "carrot";
  if (["salad", "lettuce", "spinach", "herb"].some((item) => value.includes(item))) return "salad";
  if (["rice", "pasta", "bread", "flour", "grain", "noodle"].some((item) => value.includes(item))) return "wheat";
  if (["chicken", "drumstick", "wing"].some((item) => value.includes(item))) return "chicken";
  if (["beef", "steak", "mince"].some((item) => value.includes(item))) return "beef";
  if (["fish", "salmon", "tuna", "prawn"].some((item) => value.includes(item))) return "fish";
  if (["egg"].some((item) => value.includes(item))) return "egg";
  if (["sugar", "chocolate", "honey", "sweet"].some((item) => value.includes(item))) return "sweet";
  if (["chips", "cracker", "snack", "biscuit"].some((item) => value.includes(item))) return "snack";

  return "pot";
}

function getShoppingGroupLabel(iconKey) {
  const labels = {
    beef: "Meat & Seafood",
    chicken: "Meat & Seafood",
    fish: "Meat & Seafood",
    egg: "Dairy & Eggs",
    milk: "Dairy & Eggs",
    apple: "Fruit",
    carrot: "Vegetables",
    salad: "Vegetables",
    wheat: "Pantry & Grains",
    sweet: "Snacks & Sweets",
    snack: "Snacks & Sweets",
    cup: "Drinks & Sauces",
    pot: "Other",
  };

  return labels[iconKey] || "Other";
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #fff1f5 0%, #fdf2f8 45%, #fce7f3 100%)",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },
  wrapper: {
    maxWidth: "1320px",
    margin: "0 auto",
  },
  hero: {
    marginBottom: "24px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid #f9a8d4",
    borderRadius: "28px",
    padding: "26px",
    boxShadow: "0 18px 45px rgba(244,114,182,0.12)",
    backdropFilter: "blur(8px)",
  },
  card: {
    background: "rgba(255,255,255,0.88)",
    borderRadius: "26px",
    padding: "20px",
    border: "1px solid #f9a8d4",
    boxShadow: "0 14px 34px rgba(244,114,182,0.08)",
  },
  sectionTitle: {
    color: "#881337",
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "24px",
  },
  softCard: {
    border: "1px solid #fbcfe8",
    background: "linear-gradient(to bottom right, #fce7f3, #fff1f2)",
    borderRadius: "20px",
    padding: "16px",
  },
  whiteInset: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    color: "#881337",
    border: "1px solid #fbcfe8",
    fontWeight: 600,
  },
};

function primaryButtonStyle(active = false) {
  return {
    border: active ? "none" : "1px solid #f9a8d4",
    background: active ? "#f472b6" : "white",
    color: active ? "white" : "#881337",
    borderRadius: "14px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: active ? "0 8px 18px rgba(244,114,182,0.22)" : "none",
  };
}

function smallButtonStyle(active = false) {
  return {
    border: active ? "none" : "1px solid #fbcfe8",
    background: active ? "#f472b6" : "white",
    color: active ? "white" : "#881337",
    borderRadius: "12px",
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "13px",
  };
}

function inputStyle() {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #f9a8d4",
    background: "white",
    boxSizing: "border-box",
    color: "#881337",
    outline: "none",
  };
}

export default function App() {
  const [tab, setTab] = useState("meals");
  const [meals, setMeals] = useState([]);
  const [activeMealId, setActiveMealId] = useState(null);
  const [ingredientsLibrary, setIngredientsLibrary] = useState([]);
  const [selectedMealIds, setSelectedMealIds] = useState([]);
  const [checkedItems, setCheckedItems] = useState({});
  const [ownedItems, setOwnedItems] = useState({});
  const [newMealName, setNewMealName] = useState("");
  const [editingMealId, setEditingMealId] = useState(null);
  const [editingMealName, setEditingMealName] = useState("");
  const [editingIngredientId, setEditingIngredientId] = useState(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [shoppingMode, setShoppingMode] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [adjustingMealId, setAdjustingMealId] = useState(null);
  const [adjustingServingsValue, setAdjustingServingsValue] = useState("");
  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    quantity: "",
    unit: "",
    price: "",
    calories: "",
    iconKey: "pot",
  });
  const [editingIngredientForm, setEditingIngredientForm] = useState({
    name: "",
    quantity: "",
    unit: "",
    price: "",
    calories: "",
    iconKey: "pot",
  });
  const [status, setStatus] = useState("Loading...");
  const [errorMessage, setErrorMessage] = useState("");

  const ingredientFormTemplate = useMemo(() => {
    const name = ingredientForm.name.trim();
    const quantity = Number(ingredientForm.quantity);
    const unit = ingredientForm.unit.trim();
    const price = Number(ingredientForm.price);
    const calories = Number(ingredientForm.calories);
    const iconKey = ingredientForm.iconKey || guessIconKey(name);

    const isValid =
      !!name &&
      !!unit &&
      !Number.isNaN(quantity) &&
      quantity > 0 &&
      !Number.isNaN(price) &&
      price >= 0 &&
      !Number.isNaN(calories) &&
      calories >= 0;

    return {
      isValid,
      template: isValid ? { name, quantity, unit, price, calories, iconKey } : null,
    };
  }, [ingredientForm]);

  const ingredientAlreadyInLibrary = useMemo(() => {
    if (!ingredientFormTemplate.isValid || !ingredientFormTemplate.template) return false;
    const template = ingredientFormTemplate.template;
    return ingredientsLibrary.some(
      (item) =>
        normaliseName(item.name) === normaliseName(template.name) &&
        item.unit.trim().toLowerCase() === template.unit.trim().toLowerCase() &&
        Number(item.quantity) === Number(template.quantity) &&
        Number(item.price) === Number(template.price) &&
        Number(item.calories) === Number(template.calories) &&
        item.iconKey === template.iconKey
    );
  }, [ingredientFormTemplate, ingredientsLibrary]);

  useEffect(() => {
    loadEverything();
  }, []);

  async function loadEverything() {
    try {
      setStatus("Loading...");

      const [
        { data: mealsData, error: mealsError },
        { data: ingredientsData, error: ingredientsError },
      ] = await Promise.all([
        supabase.from("meals").select("*"),
        supabase.from("ingredients").select("*"),
      ]);

      if (mealsError) throw mealsError;
      if (ingredientsError) throw ingredientsError;

      const mealRows = (mealsData || []).map((meal) => ({
        id: meal.id,
        name: meal.name,
        servings: Number(meal.servings ?? 1),
        targetServings: Number(meal.target_servings ?? meal.servings ?? 1),
        favourite: Boolean(meal.favourite ?? false),
        ingredients: [],
      }));

      const ingredientsByMeal = {};
      for (const row of ingredientsData || []) {
        if (!ingredientsByMeal[row.meal_id]) ingredientsByMeal[row.meal_id] = [];
        ingredientsByMeal[row.meal_id].push({
          id: row.id,
          name: row.name,
          quantity: Number(row.quantity ?? 0),
          unit: row.unit ?? "",
          price: Number(row.price ?? 0),
          calories: Number(row.calories ?? 0),
          iconKey: row.icon_key || guessIconKey(row.name || ""),
        });
      }

      const fullMeals = mealRows.map((meal) => ({
        ...meal,
        ingredients: ingredientsByMeal[meal.id] || [],
      }));

      setMeals(fullMeals);

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setIngredientsLibrary(parsed.ingredientsLibrary || []);
        setSelectedMealIds(parsed.selectedMealIds || []);
        setCheckedItems(parsed.checkedItems || {});
        setOwnedItems(parsed.ownedItems || {});
      }

      setStatus("Ready");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || "Failed to load app");
      setStatus("Load failed");
    }
  }

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ingredientsLibrary,
        selectedMealIds,
        checkedItems,
        ownedItems,
      })
    );
  }, [ingredientsLibrary, selectedMealIds, checkedItems, ownedItems]);

  useEffect(() => {
    const channel = supabase
      .channel("realtime-meals-app")
      .on("postgres_changes", { event: "*", schema: "public", table: "meals" }, () => loadEverything())
      .on("postgres_changes", { event: "*", schema: "public", table: "ingredients" }, () => loadEverything())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const mealsWithTotals = useMemo(() => {
    return meals.map((meal) => {
      const servings = Math.max(1, Number(meal.servings ?? 1));
      const targetServings = Math.max(1, Number(meal.targetServings ?? servings));
      const totalPriceRaw = meal.ingredients.reduce((sum, ingredient) => sum + Number(ingredient.price || 0), 0);
      const totalCaloriesRaw = meal.ingredients.reduce((sum, ingredient) => sum + Number(ingredient.calories || 0), 0);
      const perServingPrice = totalPriceRaw / servings;
      const perServingCalories = totalCaloriesRaw / servings;
      const adjustedTotalPrice = perServingPrice * targetServings;

      return {
        ...meal,
        servings,
        targetServings,
        totalPriceRaw,
        totalCaloriesRaw,
        perServingPrice,
        perServingCalories,
        adjustedTotalPrice,
      };
    });
  }, [meals]);

  const sortedMeals = useMemo(() => {
    return [...mealsWithTotals].sort((a, b) => {
      const favDiff = Number(Boolean(b.favourite)) - Number(Boolean(a.favourite));
      if (favDiff !== 0) return favDiff;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [mealsWithTotals]);

  const activeMeal =
    mealsWithTotals.find((meal) => meal.id === activeMealId) ??
    mealsWithTotals[0] ??
    null;

  useEffect(() => {
    if (!activeMealId && mealsWithTotals.length) {
      setActiveMealId(mealsWithTotals[0].id);
    }
    if (activeMealId && !mealsWithTotals.some((meal) => meal.id === activeMealId)) {
      setActiveMealId(mealsWithTotals[0]?.id ?? null);
    }
  }, [mealsWithTotals, activeMealId]);

  const combinedSelectedIngredients = useMemo(() => {
    const chosenMeals = mealsWithTotals.filter((meal) => selectedMealIds.includes(meal.id));
    const combined = new Map();

    chosenMeals.forEach((meal) => {
      const defaultServings = Math.max(1, Number(meal.servings ?? 1));
      const targetServings = Math.max(1, Number(meal.targetServings ?? defaultServings));

      meal.ingredients.forEach((ingredient) => {
        const key = `${normaliseName(ingredient.name)}__${ingredient.unit.trim().toLowerCase()}`;
        const quantityNeeded = (Number(ingredient.quantity) / defaultServings) * targetServings;
        const priceNeeded = (Number(ingredient.price || 0) / defaultServings) * targetServings;
        const caloriesNeeded = (Number(ingredient.calories || 0) / defaultServings) * targetServings;
        const existing = combined.get(key);

        if (existing) {
          existing.quantity += quantityNeeded;
          existing.price += priceNeeded;
          existing.calories += caloriesNeeded;
        } else {
          combined.set(key, {
            key,
            name: ingredient.name.trim(),
            quantity: quantityNeeded,
            unit: ingredient.unit.trim(),
            price: priceNeeded,
            calories: caloriesNeeded,
            iconKey: ingredient.iconKey || guessIconKey(ingredient.name),
          });
        }
      });
    });

    return Array.from(combined.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [mealsWithTotals, selectedMealIds]);

  const shoppingList = useMemo(() => {
    return combinedSelectedIngredients
      .map((item) => {
        const ownedQuantity = Number(ownedItems[item.key] ?? 0);
        const remainingQuantity = Math.max(item.quantity - ownedQuantity, 0);
        const remainingRatio = item.quantity > 0 ? remainingQuantity / item.quantity : 0;
        return {
          ...item,
          ownedQuantity,
          remainingQuantity,
          remainingPrice: item.price * remainingRatio,
          remainingCalories: item.calories * remainingRatio,
        };
      })
      .filter((item) => item.remainingQuantity > 0);
  }, [combinedSelectedIngredients, ownedItems]);

  const visibleShoppingList = useMemo(() => {
    if (!hideChecked) return shoppingList;
    return shoppingList.filter((item) => !checkedItems[item.key]);
  }, [shoppingList, checkedItems, hideChecked]);

  const groupedShoppingList = useMemo(() => {
    const order = [
      "Vegetables",
      "Fruit",
      "Meat & Seafood",
      "Dairy & Eggs",
      "Pantry & Grains",
      "Drinks & Sauces",
      "Snacks & Sweets",
      "Other",
    ];

    const groups = new Map();
    visibleShoppingList.forEach((item) => {
      const label = getShoppingGroupLabel(item.iconKey);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(item);
    });

    return Array.from(groups.entries())
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([label, items]) => ({ label, items }));
  }, [visibleShoppingList]);

  const filteredIngredientsLibrary = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) return ingredientsLibrary;
    return ingredientsLibrary.filter(
      (ingredient) =>
        ingredient.name.toLowerCase().includes(query) ||
        ingredient.unit.toLowerCase().includes(query)
    );
  }, [ingredientsLibrary, librarySearch]);

  async function addMeal() {
    const name = newMealName.trim();
    if (!name) return;

    const row = {
      id: crypto.randomUUID(),
      name,
      servings: 1,
      target_servings: 1,
      favourite: false,
    };

    const { error } = await supabase.from("meals").insert([row]);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setNewMealName("");
  }

  async function deleteMeal(mealId) {
    const ingredientIds = meals.find((m) => m.id === mealId)?.ingredients || [];
    if (ingredientIds.length) {
      const { error: ingredientError } = await supabase.from("ingredients").delete().eq("meal_id", mealId);
      if (ingredientError) {
        setErrorMessage(ingredientError.message);
        return;
      }
    }

    const { error } = await supabase.from("meals").delete().eq("id", mealId);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSelectedMealIds((current) => current.filter((id) => id !== mealId));
  }

  async function duplicateMeal(mealId) {
    const mealToCopy = meals.find((meal) => meal.id === mealId);
    if (!mealToCopy) return;

    const duplicatedMealId = crypto.randomUUID();

    const mealRow = {
      id: duplicatedMealId,
      name: `${mealToCopy.name} Copy`,
      servings: mealToCopy.servings ?? 1,
      target_servings: mealToCopy.targetServings ?? mealToCopy.servings ?? 1,
      favourite: mealToCopy.favourite ?? false,
    };

    const { error: mealError } = await supabase.from("meals").insert([mealRow]);
    if (mealError) {
      setErrorMessage(mealError.message);
      return;
    }

    if (mealToCopy.ingredients.length > 0) {
      const ingredientRows = mealToCopy.ingredients.map((ingredient) => ({
        id: crypto.randomUUID(),
        meal_id: duplicatedMealId,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        price: ingredient.price,
        calories: ingredient.calories,
        icon_key: ingredient.iconKey,
      }));

      const { error: ingredientsError } = await supabase.from("ingredients").insert(ingredientRows);
      if (ingredientsError) {
        setErrorMessage(ingredientsError.message);
      }
    }
  }

  function startEditingMeal(meal) {
    setEditingMealId(meal.id);
    setEditingMealName(meal.name);
  }

  async function saveMealName() {
    const name = editingMealName.trim();
    if (!editingMealId || !name) return;

    const { error } = await supabase.from("meals").update({ name }).eq("id", editingMealId);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEditingMealId(null);
    setEditingMealName("");
  }

  function cancelEditingMeal() {
    setEditingMealId(null);
    setEditingMealName("");
  }

  async function toggleFavourite(mealId, currentValue) {
    const { error } = await supabase
      .from("meals")
      .update({ favourite: !Boolean(currentValue) })
      .eq("id", mealId);

    if (error) setErrorMessage(error.message);
  }

  function toggleMealSelection(mealId) {
    setSelectedMealIds((current) =>
      current.includes(mealId) ? current.filter((id) => id !== mealId) : [...current, mealId]
    );
  }

  function startAdjustingServings(meal) {
    setAdjustingMealId(meal.id);
    setAdjustingServingsValue(String(meal.targetServings ?? meal.servings ?? 1));
  }

  async function saveAdjustedServings(mealId) {
    const targetServings = Math.max(1, Number(adjustingServingsValue) || 1);
    const { error } = await supabase
      .from("meals")
      .update({ target_servings: targetServings })
      .eq("id", mealId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setAdjustingMealId(null);
    setAdjustingServingsValue("");
  }

  function cancelAdjustingServings() {
    setAdjustingMealId(null);
    setAdjustingServingsValue("");
  }

  async function setDefaultServings(mealId, value) {
    const servings = Math.max(1, Number(value) || 1);
    const meal = meals.find((m) => m.id === mealId);
    const previousDefault = Math.max(1, Number(meal?.servings ?? 1));
    const previousTarget = Math.max(1, Number(meal?.targetServings ?? previousDefault));
    const nextTarget = previousTarget === previousDefault ? servings : previousTarget;

    const { error } = await supabase
      .from("meals")
      .update({ servings, target_servings: nextTarget })
      .eq("id", mealId);

    if (error) setErrorMessage(error.message);
  }

  async function addIngredientToMeal() {
    if (!activeMeal || !ingredientFormTemplate.isValid || !ingredientFormTemplate.template) return;

    const t = ingredientFormTemplate.template;
    const row = {
      id: crypto.randomUUID(),
      meal_id: activeMeal.id,
      name: t.name,
      quantity: t.quantity,
      unit: t.unit,
      price: t.price,
      calories: t.calories,
      icon_key: t.iconKey,
    };

    const { error } = await supabase.from("ingredients").insert([row]);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setIngredientForm({
      name: "",
      quantity: "",
      unit: "",
      price: "",
      calories: "",
      iconKey: "pot",
    });
  }

  function addIngredientToLibraryOnly() {
    if (!ingredientFormTemplate.isValid || !ingredientFormTemplate.template || ingredientAlreadyInLibrary) return;
    setIngredientsLibrary((current) => [...current, { id: crypto.randomUUID(), ...ingredientFormTemplate.template }]);
  }

  function addIngredientFromLibrary(libraryIngredient) {
    setIngredientForm({
      name: libraryIngredient.name,
      quantity: String(libraryIngredient.quantity),
      unit: libraryIngredient.unit,
      price: String(libraryIngredient.price),
      calories: String(libraryIngredient.calories),
      iconKey: libraryIngredient.iconKey,
    });
  }

  function deleteLibraryIngredient(libraryIngredientId) {
    setIngredientsLibrary((current) => current.filter((item) => item.id !== libraryIngredientId));
  }

  function ingredientExistsInLibrary(ingredient) {
    return ingredientsLibrary.some(
      (item) =>
        normaliseName(item.name) === normaliseName(ingredient.name) &&
        item.unit.trim().toLowerCase() === ingredient.unit.trim().toLowerCase() &&
        Number(item.quantity) === Number(ingredient.quantity) &&
        Number(item.price) === Number(ingredient.price) &&
        Number(item.calories) === Number(ingredient.calories) &&
        item.iconKey === ingredient.iconKey
    );
  }

  function saveIngredientToLibrary(ingredient) {
    if (ingredientExistsInLibrary(ingredient)) return;
    setIngredientsLibrary((current) => [...current, { ...ingredient, id: crypto.randomUUID() }]);
  }

  function startEditingIngredient(ingredient) {
    setEditingIngredientId(ingredient.id);
    setEditingIngredientForm({
      name: ingredient.name,
      quantity: String(ingredient.quantity),
      unit: ingredient.unit,
      price: String(ingredient.price),
      calories: String(ingredient.calories),
      iconKey: ingredient.iconKey,
    });
  }

  function cancelEditingIngredient() {
    setEditingIngredientId(null);
    setEditingIngredientForm({
      name: "",
      quantity: "",
      unit: "",
      price: "",
      calories: "",
      iconKey: "pot",
    });
  }

  async function saveIngredient(mealId, ingredientId) {
    const name = editingIngredientForm.name.trim();
    const quantity = Number(editingIngredientForm.quantity);
    const unit = editingIngredientForm.unit.trim();
    const price = Number(editingIngredientForm.price);
    const calories = Number(editingIngredientForm.calories);
    const iconKey = editingIngredientForm.iconKey || guessIconKey(name);

    if (
      !name ||
      !unit ||
      Number.isNaN(quantity) ||
      quantity <= 0 ||
      Number.isNaN(price) ||
      price < 0 ||
      Number.isNaN(calories) ||
      calories < 0
    )
      return;

    const { error } = await supabase
      .from("ingredients")
      .update({
        name,
        quantity,
        unit,
        price,
        calories,
        icon_key: iconKey,
      })
      .eq("id", ingredientId)
      .eq("meal_id", mealId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    cancelEditingIngredient();
  }

  async function deleteIngredient(mealId, ingredientId) {
    const { error } = await supabase.from("ingredients").delete().eq("id", ingredientId).eq("meal_id", mealId);
    if (error) setErrorMessage(error.message);
  }

  function setOwnedQuantity(itemKey, value) {
    if (value === "") {
      setOwnedItems((current) => {
        const next = { ...current };
        delete next[itemKey];
        return next;
      });
      return;
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue) || numericValue < 0) return;
    setOwnedItems((current) => ({ ...current, [itemKey]: numericValue }));
  }

  function clearOwnedItems() {
    setOwnedItems({});
  }

  function toggleChecked(itemKey) {
    setCheckedItems((current) => ({ ...current, [itemKey]: !current[itemKey] }));
  }

  function toggleGroupChecked(groupItems) {
    const allChecked = groupItems.every((item) => checkedItems[item.key]);
    const updates = {};
    groupItems.forEach((item) => {
      updates[item.key] = !allChecked;
    });
    setCheckedItems((current) => ({ ...current, ...updates }));
  }

  function clearShoppingTicks() {
    setCheckedItems({});
  }

  function clearWeek() {
    setSelectedMealIds([]);
    setOwnedItems({});
    setCheckedItems({});
  }

  const shoppingTotal = shoppingList.reduce((sum, item) => sum + item.remainingPrice, 0);
  const shoppingCalories = shoppingList.reduce((sum, item) => sum + item.remainingCalories, 0);

  return (
    <div style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.hero}>
          <h1 style={{ color: "#881337", margin: 0, fontSize: "34px" }}>Meal Planner & Shopping List</h1>
          <p style={{ color: "#9d174d", marginTop: "10px", marginBottom: 0 }}>{status}</p>
          {errorMessage ? (
            <div
              style={{
                marginTop: "14px",
                color: "#991b1b",
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: "14px",
                padding: "12px 14px",
              }}
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["meals", "ingredients", "shopping"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                style={primaryButtonStyle(tab === item)}
              >
                {item === "shopping" ? "Shopping List" : item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          <button onClick={clearWeek} style={primaryButtonStyle(false)}>
            Clear week
          </button>
        </div>

        {tab === "meals" && (
          <div style={{ display: "grid", gridTemplateColumns: "3fr 5fr", gap: "24px" }}>
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Meals</h2>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ color: "#9d174d", fontWeight: 700, marginBottom: "8px" }}>New meal</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    value={newMealName}
                    onChange={(e) => setNewMealName(e.target.value)}
                    placeholder="Add a meal"
                    style={inputStyle()}
                  />
                  <button onClick={addMeal} style={primaryButtonStyle(true)}>Add</button>
                </div>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                {sortedMeals.map((meal) => {
                  const isEditing = editingMealId === meal.id;
                  const isAdjustingServings = adjustingMealId === meal.id;

                  return (
                    <div key={meal.id} style={styles.softCard}>
                      {isEditing ? (
                        <div>
                          <div style={{ color: "#9d174d", fontSize: "14px", marginBottom: "8px", fontWeight: 700 }}>
                            Meal name
                          </div>
                          <input
                            autoFocus
                            value={editingMealName}
                            onChange={(e) => setEditingMealName(e.target.value)}
                            style={{ ...inputStyle(), marginBottom: "10px" }}
                          />
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={saveMealName} style={primaryButtonStyle(true)}>Save</button>
                            <button onClick={cancelEditingMeal} style={primaryButtonStyle(false)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setActiveMealId(meal.id)}
                            style={{
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              width: "100%",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontWeight: 700, color: "#881337", marginBottom: "4px", fontSize: "18px" }}>
                              {meal.name}
                            </div>
                            <div style={{ color: "#9d174d", fontSize: "13px" }}>
                              {meal.ingredients.length} ingredient{meal.ingredients.length === 1 ? "" : "s"}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                              <div style={styles.whiteInset}>{formatCurrency(meal.adjustedTotalPrice)}</div>
                              <div style={styles.whiteInset}>{formatCalories(meal.perServingCalories)}</div>
                              <div style={styles.whiteInset}>
                                {meal.servings} serving{meal.servings === 1 ? "" : "s"}
                              </div>
                            </div>
                          </button>

                          <div style={{ marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                background: "white",
                                border: "1px solid #fbcfe8",
                                borderRadius: "12px",
                                padding: "9px 12px",
                                color: "#881337",
                                fontWeight: 700,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedMealIds.includes(meal.id)}
                                onChange={() => toggleMealSelection(meal.id)}
                              />
                              Cook
                            </label>

                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              <button onClick={() => toggleFavourite(meal.id, meal.favourite)} style={smallButtonStyle()}>
                                {meal.favourite ? "★" : "☆"}
                              </button>

                              {isAdjustingServings ? (
                                <>
                                  <input
                                    autoFocus
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={adjustingServingsValue}
                                    onChange={(e) => setAdjustingServingsValue(e.target.value)}
                                    style={{ ...inputStyle(), width: "100px" }}
                                  />
                                  <button onClick={() => saveAdjustedServings(meal.id)} style={smallButtonStyle(true)}>
                                    Save
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => startAdjustingServings(meal)} style={smallButtonStyle()}>
                                  Adjust servings: {meal.targetServings}
                                </button>
                              )}

                              <button onClick={() => startEditingMeal(meal)} style={smallButtonStyle()}>
                                Rename
                              </button>
                              <button onClick={() => duplicateMeal(meal.id)} style={smallButtonStyle()}>
                                Copy
                              </button>
                              <button onClick={() => deleteMeal(meal.id)} style={smallButtonStyle()}>
                                Delete
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
                <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>
                  {activeMeal ? `${activeMeal.name} ingredients` : "Choose a meal"}
                </h2>
                {activeMeal ? (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <div style={styles.whiteInset}>Total {formatCurrency(activeMeal.adjustedTotalPrice)}</div>
                    <div style={styles.whiteInset}>{formatCalories(activeMeal.perServingCalories)}</div>
                  </div>
                ) : null}
              </div>

              {activeMeal ? (
                <>
                  <div style={{ ...styles.softCard, marginBottom: "20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "12px", alignItems: "end" }}>
                      <div>
                        <div style={{ color: "#881337", fontWeight: 700, marginBottom: "6px" }}>Default servings</div>
                        <div style={{ color: "#9d174d" }}>
                          This is the base recipe amount that the meal ingredients are built on.
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#9d174d", fontSize: "14px", marginBottom: "6px", fontWeight: 700 }}>
                          Servings
                        </div>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={activeMeal.servings ?? 1}
                          onChange={(e) => setDefaultServings(activeMeal.id, e.target.value)}
                          style={inputStyle()}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 0.7fr 0.8fr 0.8fr 0.8fr auto auto",
                      gap: "10px",
                      marginBottom: "20px",
                    }}
                  >
                    <input
                      value={ingredientForm.name}
                      onChange={(e) =>
                        setIngredientForm((current) => ({
                          ...current,
                          name: e.target.value,
                          iconKey: e.target.value ? guessIconKey(e.target.value) : current.iconKey,
                        }))
                      }
                      placeholder="Ingredient"
                      style={inputStyle()}
                    />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={ingredientForm.quantity}
                      onChange={(e) => setIngredientForm((current) => ({ ...current, quantity: e.target.value }))}
                      placeholder="Qty"
                      style={inputStyle()}
                    />
                    <input
                      value={ingredientForm.unit}
                      onChange={(e) => setIngredientForm((current) => ({ ...current, unit: e.target.value }))}
                      placeholder="Unit"
                      style={inputStyle()}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ingredientForm.price}
                      onChange={(e) => setIngredientForm((current) => ({ ...current, price: e.target.value }))}
                      placeholder="Price"
                      style={inputStyle()}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={ingredientForm.calories}
                      onChange={(e) => setIngredientForm((current) => ({ ...current, calories: e.target.value }))}
                      placeholder="Calories"
                      style={inputStyle()}
                    />
                    <button onClick={addIngredientToMeal} style={primaryButtonStyle(true)}>Add</button>
                    <button onClick={addIngredientToLibraryOnly} style={primaryButtonStyle(false)}>
                      {ingredientAlreadyInLibrary ? "✓" : "Save"}
                    </button>
                  </div>

                  <div style={{ marginBottom: "18px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {Object.entries(ICON_OPTIONS).map(([key, emoji]) => (
                      <button
                        key={key}
                        onClick={() => setIngredientForm((current) => ({ ...current, iconKey: key }))}
                        style={{
                          ...smallButtonStyle(),
                          background: ingredientForm.iconKey === key ? "#fbcfe8" : "white",
                          minWidth: "46px",
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "5fr 3fr", gap: "24px" }}>
                    <div style={{ display: "grid", gap: "12px" }}>
                      {activeMeal.ingredients.length === 0 ? (
                        <div style={{ ...styles.softCard, color: "#9d174d" }}>No ingredients yet.</div>
                      ) : (
                        activeMeal.ingredients.map((ingredient) => {
                          const isEditing = editingIngredientId === ingredient.id;

                          return (
                            <div key={ingredient.id} style={styles.softCard}>
                              {isEditing ? (
                                <>
                                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.8fr 0.8fr 0.8fr", gap: "10px", marginBottom: "12px" }}>
                                    <input value={editingIngredientForm.name} onChange={(e) => setEditingIngredientForm((c) => ({ ...c, name: e.target.value }))} style={inputStyle()} />
                                    <input type="number" value={editingIngredientForm.quantity} onChange={(e) => setEditingIngredientForm((c) => ({ ...c, quantity: e.target.value }))} style={inputStyle()} />
                                    <input value={editingIngredientForm.unit} onChange={(e) => setEditingIngredientForm((c) => ({ ...c, unit: e.target.value }))} style={inputStyle()} />
                                    <input type="number" value={editingIngredientForm.price} onChange={(e) => setEditingIngredientForm((c) => ({ ...c, price: e.target.value }))} style={inputStyle()} />
                                    <input type="number" value={editingIngredientForm.calories} onChange={(e) => setEditingIngredientForm((c) => ({ ...c, calories: e.target.value }))} style={inputStyle()} />
                                  </div>

                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {Object.entries(ICON_OPTIONS).map(([key, emoji]) => (
                                      <button
                                        key={key}
                                        onClick={() => setEditingIngredientForm((c) => ({ ...c, iconKey: key }))}
                                        style={{
                                          ...smallButtonStyle(),
                                          background: editingIngredientForm.iconKey === key ? "#fbcfe8" : "white",
                                          minWidth: "46px",
                                        }}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>

                                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                                    <button onClick={() => saveIngredient(activeMeal.id, ingredient.id)} style={primaryButtonStyle(true)}>Save</button>
                                    <button onClick={cancelEditingIngredient} style={primaryButtonStyle(false)}>Cancel</button>
                                  </div>
                                </>
                              ) : (
                                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                                  <div style={{ display: "flex", gap: "12px" }}>
                                    <div
                                      style={{
                                        width: "46px",
                                        height: "46px",
                                        borderRadius: "16px",
                                        background: "rgba(255,255,255,0.85)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "24px",
                                        border: "1px solid #fbcfe8",
                                      }}
                                    >
                                      {ICON_OPTIONS[ingredient.iconKey] || "🍲"}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: "#881337" }}>{ingredient.name}</div>
                                      <div style={{ color: "#9d174d", marginTop: "4px" }}>
                                        {formatQuantity(ingredient.quantity)} {ingredient.unit}
                                      </div>
                                      <div style={{ color: "#9d174d", marginTop: "4px" }}>{formatCurrency(ingredient.price)}</div>
                                      <div style={{ color: "#9d174d", marginTop: "4px" }}>{formatCalories(ingredient.calories)}</div>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", gap: "6px", alignItems: "start", flexWrap: "wrap" }}>
                                    <button onClick={() => saveIngredientToLibrary(ingredient)} style={smallButtonStyle()}>
                                      {ingredientExistsInLibrary(ingredient) ? "✓" : "Save"}
                                    </button>
                                    <button onClick={() => startEditingIngredient(ingredient)} style={smallButtonStyle()}>Edit</button>
                                    <button onClick={() => deleteIngredient(activeMeal.id, ingredient.id)} style={smallButtonStyle()}>Delete</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div style={{ ...styles.softCard, padding: "16px" }}>
                      <h3 style={{ color: "#881337", marginTop: 0, marginBottom: "6px" }}>Ingredient library</h3>
                      <div style={{ color: "#9d174d", marginBottom: "12px" }}>
                        Saved ingredients you can reuse in any meal.
                      </div>

                      <div style={{ marginBottom: "12px" }}>
                        <input
                          value={librarySearch}
                          onChange={(e) => setLibrarySearch(e.target.value)}
                          placeholder="Search ingredients"
                          style={inputStyle()}
                        />
                      </div>

                      <div style={{ maxHeight: "32rem", overflowY: "auto", display: "grid", gap: "10px", paddingRight: "4px" }}>
                        {filteredIngredientsLibrary.map((ingredient) => (
                          <div
                            key={ingredient.id}
                            style={{
                              border: "1px solid #fbcfe8",
                              background: "rgba(255,255,255,0.88)",
                              borderRadius: "16px",
                              padding: "12px",
                            }}
                          >
                            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "10px", alignItems: "center" }}>
                              <div
                                style={{
                                  width: "42px",
                                  height: "42px",
                                  borderRadius: "14px",
                                  background: "#fff1f5",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "22px",
                                  border: "1px solid #fbcfe8",
                                }}
                              >
                                {ICON_OPTIONS[ingredient.iconKey] || "🍲"}
                              </div>

                              <div>
                                <div style={{ fontWeight: 700, color: "#881337" }}>{ingredient.name}</div>
                                <div style={{ color: "#9d174d", fontSize: "13px" }}>
                                  {formatQuantity(ingredient.quantity)} {ingredient.unit}
                                </div>
                                <div style={{ color: "#9d174d", fontSize: "13px" }}>
                                  {formatCurrency(ingredient.price)}
                                </div>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <button onClick={() => addIngredientFromLibrary(ingredient)} style={smallButtonStyle()}>
                                  Use
                                </button>
                                <button onClick={() => deleteLibraryIngredient(ingredient.id)} style={smallButtonStyle()}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {filteredIngredientsLibrary.length === 0 && (
                          <div style={{ color: "#9d174d" }}>No saved ingredients found.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ color: "#9d174d" }}>No meal selected</div>
              )}
            </div>
          </div>
        )}

        {tab === "ingredients" && (
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Combined ingredients</h2>
              <button onClick={clearOwnedItems} style={primaryButtonStyle(false)}>
                Clear owned items
              </button>
            </div>

            {combinedSelectedIngredients.length === 0 ? (
              <div style={{ color: "#9d174d" }}>
                Select one or more meals in the Meals tab to show their ingredients here.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {combinedSelectedIngredients.map((item) => {
                  const ownedQuantity = Number(ownedItems[item.key] ?? 0);
                  const remainingQuantity = Math.max(item.quantity - ownedQuantity, 0);
                  const isFullyCovered = remainingQuantity <= 0;

                  return (
                    <div
                      key={item.key}
                      style={{
                        border: "1px solid #fbcfe8",
                        background: isFullyCovered ? "#fce7f3" : "white",
                        borderRadius: "20px",
                        padding: "16px",
                        boxShadow: "0 10px 24px rgba(244,114,182,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "44px",
                                height: "44px",
                                borderRadius: "16px",
                                background: "#fff1f5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "22px",
                                border: "1px solid #fbcfe8",
                              }}
                            >
                              {ICON_OPTIONS[item.iconKey] || "🍲"}
                            </div>
                            <div style={{ fontWeight: 700, color: "#881337", textDecoration: isFullyCovered ? "line-through" : "none" }}>
                              {item.name}
                            </div>
                          </div>
                          <div style={{ marginTop: "10px", color: "#9d174d" }}>
                            Total needed {formatQuantity(remainingQuantity)} {item.unit}
                          </div>
                          <div style={{ color: "#9d174d" }}>
                            Ingredient total {formatCurrency(item.price)}
                          </div>
                        </div>

                        <div style={{ minWidth: "260px" }}>
                          <div style={{ color: "#9d174d", marginBottom: "8px", fontWeight: 700 }}>Already have</div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={ownedItems[item.key] ?? ""}
                              onChange={(e) => setOwnedQuantity(item.key, e.target.value)}
                              placeholder={`0 ${item.unit}`}
                              style={inputStyle()}
                            />
                            <label
                              style={{
                                border: "1px solid #fbcfe8",
                                background: "white",
                                borderRadius: "14px",
                                padding: "10px 14px",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isFullyCovered}
                                onChange={(e) => setOwnedQuantity(item.key, e.target.checked ? String(item.quantity) : "")}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "shopping" && (
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Shopping List</h2>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <div style={primaryButtonStyle(false)}>Total {formatCurrency(shoppingTotal)}</div>
                <div style={primaryButtonStyle(false)}>{formatCalories(shoppingCalories)}</div>
                <button onClick={() => setShoppingMode((current) => !current)} style={primaryButtonStyle(shoppingMode)}>
                  Shopping mode {shoppingMode ? "on" : "off"}
                </button>
                <button onClick={clearShoppingTicks} style={primaryButtonStyle(false)}>
                  Clear ticks
                </button>
                <button onClick={() => setHideChecked((current) => !current)} style={primaryButtonStyle(hideChecked)}>
                  Hide checked {hideChecked ? "on" : "off"}
                </button>
              </div>
            </div>

            {visibleShoppingList.length === 0 ? (
              <div style={{ color: "#9d174d" }}>
                Select meals in the Meals tab, then mark any ingredients you already have in the Ingredients tab.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "18px" }}>
                {groupedShoppingList.map((group) => (
                  <div key={group.label} style={{ display: "grid", gap: "10px" }}>
                    <button
                      onClick={() => toggleGroupChecked(group.items)}
                      style={{
                        ...primaryButtonStyle(false),
                        textAlign: "left",
                        background: "#fce7f3",
                      }}
                    >
                      {group.label}
                    </button>

                    {group.items.map((item) => {
                      const isChecked = !!checkedItems[item.key];
                      return (
                        <label
                          key={item.key}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "16px",
                            border: "1px solid #fbcfe8",
                            background: isChecked ? "#fce7f3" : "white",
                            borderRadius: "20px",
                            padding: shoppingMode ? "20px" : "16px",
                            opacity: isChecked ? 0.8 : 1,
                            cursor: "pointer",
                            boxShadow: "0 10px 24px rgba(244,114,182,0.05)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleChecked(item.key)}
                              style={{ width: shoppingMode ? "22px" : "16px", height: shoppingMode ? "22px" : "16px" }}
                            />
                            <div
                              style={{
                                width: shoppingMode ? "54px" : "44px",
                                height: shoppingMode ? "54px" : "44px",
                                borderRadius: "16px",
                                background: "#fff1f5",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: shoppingMode ? "28px" : "22px",
                                border: "1px solid #fbcfe8",
                              }}
                            >
                              {ICON_OPTIONS[item.iconKey] || "🍲"}
                            </div>
                            <div>
                              <div
                                style={{
                                  color: "#881337",
                                  fontWeight: 700,
                                  fontSize: shoppingMode ? "20px" : "16px",
                                  textDecoration: isChecked ? "line-through" : "none",
                                }}
                              >
                                {item.name}
                              </div>
                              <div style={{ color: "#9d174d", fontSize: shoppingMode ? "18px" : "14px" }}>
                                {formatQuantity(item.remainingQuantity)} {item.unit}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            {!shoppingMode && <div style={{ color: "#9d174d", fontSize: "13px" }}>Item price</div>}
                            <div style={{ color: "#881337", fontWeight: 700, fontSize: shoppingMode ? "20px" : "16px" }}>
                              {formatCurrency(item.remainingPrice)}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}