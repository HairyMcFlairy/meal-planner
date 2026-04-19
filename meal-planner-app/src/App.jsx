import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

function formatQuantity(quantity) {
  const num = Number(quantity || 0);
  if (Number.isInteger(num)) return String(num);
  return String(Number(num.toFixed(2)));
}

export default function App() {
  const [meals, setMeals] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [activeMealId, setActiveMealId] = useState(null);
  const [newMealName, setNewMealName] = useState("");
  const [editingMealId, setEditingMealId] = useState(null);
  const [editingMealName, setEditingMealName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sortedMeals = useMemo(() => {
    return [...meals].sort((a, b) => a.name.localeCompare(b.name));
  }, [meals]);

  const ingredientsByMeal = useMemo(() => {
    const grouped = {};
    for (const ingredient of ingredients) {
      if (!grouped[ingredient.meal_id]) grouped[ingredient.meal_id] = [];
      grouped[ingredient.meal_id].push(ingredient);
    }
    return grouped;
  }, [ingredients]);

  const activeMeal =
    sortedMeals.find((meal) => meal.id === activeMealId) ??
    sortedMeals[0] ??
    null;

  useEffect(() => {
    if (!activeMealId && sortedMeals.length > 0) {
      setActiveMealId(sortedMeals[0].id);
    }

    if (activeMealId && !sortedMeals.some((meal) => meal.id === activeMealId)) {
      setActiveMealId(sortedMeals[0]?.id ?? null);
    }
  }, [sortedMeals, activeMealId]);

  useEffect(() => {
  loadData();

  const channel = supabase
    .channel("realtime-meals")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "meals" },
      () => loadData()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ingredients" },
      () => loadData()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

  async function loadData() {
    setLoading(true);
    setErrorMessage("");

    const { data: mealsData, error: mealsError } = await supabase
      .from("meals")
      .select("*");

    if (mealsError) {
      setErrorMessage(mealsError.message);
      setLoading(false);
      return;
    }

    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from("ingredients")
      .select("*");

    if (ingredientsError) {
      setErrorMessage(ingredientsError.message);
      setLoading(false);
      return;
    }

    setMeals(mealsData ?? []);
    setIngredients(ingredientsData ?? []);
    setLoading(false);
  }

  async function addMeal() {
    const name = newMealName.trim();
    if (!name) return;

    setSaving(true);
    setErrorMessage("");

    const newMeal = {
      id: crypto.randomUUID(),
      name,
      servings: 1,
      target_servings: 1,
      favourite: false,
    };

    const { error } = await supabase.from("meals").insert([newMeal]);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setMeals((current) => [...current, newMeal]);
    setNewMealName("");
    setActiveMealId(newMeal.id);
    setSaving(false);
  }

  async function deleteMeal(mealId) {
    setSaving(true);
    setErrorMessage("");

    const { error: ingredientDeleteError } = await supabase
      .from("ingredients")
      .delete()
      .eq("meal_id", mealId);

    if (ingredientDeleteError) {
      setErrorMessage(ingredientDeleteError.message);
      setSaving(false);
      return;
    }

    const { error: mealDeleteError } = await supabase
      .from("meals")
      .delete()
      .eq("id", mealId);

    if (mealDeleteError) {
      setErrorMessage(mealDeleteError.message);
      setSaving(false);
      return;
    }

    setIngredients((current) =>
      current.filter((ingredient) => ingredient.meal_id !== mealId)
    );
    setMeals((current) => current.filter((meal) => meal.id !== mealId));
    setSaving(false);
  }

  async function duplicateMeal(mealId) {
    const mealToCopy = meals.find((meal) => meal.id === mealId);
    if (!mealToCopy) return;

    const sourceIngredients = ingredients.filter(
      (ingredient) => ingredient.meal_id === mealId
    );

    setSaving(true);
    setErrorMessage("");

    const duplicatedMeal = {
      ...mealToCopy,
      id: crypto.randomUUID(),
      name: `${mealToCopy.name} Copy`,
    };

    const { error: mealInsertError } = await supabase
      .from("meals")
      .insert([duplicatedMeal]);

    if (mealInsertError) {
      setErrorMessage(mealInsertError.message);
      setSaving(false);
      return;
    }

    const duplicatedIngredients = sourceIngredients.map((ingredient) => ({
      ...ingredient,
      id: crypto.randomUUID(),
      meal_id: duplicatedMeal.id,
    }));

    if (duplicatedIngredients.length > 0) {
      const { error: ingredientInsertError } = await supabase
        .from("ingredients")
        .insert(duplicatedIngredients);

      if (ingredientInsertError) {
        setErrorMessage(ingredientInsertError.message);
        setSaving(false);
        return;
      }
    }

    setMeals((current) => [...current, duplicatedMeal]);
    setIngredients((current) => [...current, ...duplicatedIngredients]);
    setActiveMealId(duplicatedMeal.id);
    setSaving(false);
  }

  function startEditingMeal(meal) {
    setEditingMealId(meal.id);
    setEditingMealName(meal.name);
  }

  async function saveMealName() {
    const name = editingMealName.trim();
    if (!editingMealId || !name) return;

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase
      .from("meals")
      .update({ name })
      .eq("id", editingMealId);

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setMeals((current) =>
      current.map((meal) =>
        meal.id === editingMealId ? { ...meal, name } : meal
      )
    );

    setEditingMealId(null);
    setEditingMealName("");
    setSaving(false);
  }

  function cancelEditingMeal() {
    setEditingMealId(null);
    setEditingMealName("");
  }

  async function addSampleData() {
    setSaving(true);
    setErrorMessage("");

    const spaghettiMealId = crypto.randomUUID();
    const stirFryMealId = crypto.randomUUID();

    const sampleMeals = [
      {
        id: spaghettiMealId,
        name: "Spaghetti Bolognese",
        servings: 4,
        target_servings: 4,
        favourite: false,
      },
      {
        id: stirFryMealId,
        name: "Chicken Stir Fry",
        servings: 4,
        target_servings: 4,
        favourite: false,
      },
    ];

    const sampleIngredients = [
      {
        id: crypto.randomUUID(),
        meal_id: spaghettiMealId,
        name: "Mince",
        quantity: 500,
        unit: "g",
      },
      {
        id: crypto.randomUUID(),
        meal_id: spaghettiMealId,
        name: "Pasta",
        quantity: 500,
        unit: "g",
      },
      {
        id: crypto.randomUUID(),
        meal_id: spaghettiMealId,
        name: "Pasta Sauce",
        quantity: 1,
        unit: "jar",
      },
      {
        id: crypto.randomUUID(),
        meal_id: stirFryMealId,
        name: "Chicken Breast",
        quantity: 500,
        unit: "g",
      },
      {
        id: crypto.randomUUID(),
        meal_id: stirFryMealId,
        name: "Rice",
        quantity: 300,
        unit: "g",
      },
      {
        id: crypto.randomUUID(),
        meal_id: stirFryMealId,
        name: "Soy Sauce",
        quantity: 100,
        unit: "ml",
      },
    ];

    const { error: mealError } = await supabase.from("meals").insert(sampleMeals);

    if (mealError) {
      setErrorMessage(mealError.message);
      setSaving(false);
      return;
    }

    const { error: ingredientError } = await supabase
      .from("ingredients")
      .insert(sampleIngredients);

    if (ingredientError) {
      setErrorMessage(ingredientError.message);
      setSaving(false);
      return;
    }

    setMeals((current) => [...current, ...sampleMeals]);
    setIngredients((current) => [...current, ...sampleIngredients]);
    setSaving(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff1f5",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            marginBottom: "24px",
            background: "rgba(255,255,255,0.85)",
            border: "1px solid #f9a8d4",
            borderRadius: "24px",
            padding: "24px",
          }}
        >
          <h1 style={{ color: "#881337", margin: 0 }}>Meal Planner App</h1>
          <p style={{ color: "#9d174d", marginTop: "8px" }}>
            Supabase-connected test version
          </p>
          {errorMessage ? (
            <div
              style={{
                marginTop: "12px",
                color: "#991b1b",
                background: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 5fr",
            gap: "24px",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.9)",
              borderRadius: "24px",
              padding: "20px",
              border: "1px solid #f9a8d4",
            }}
          >
            <h2 style={{ color: "#881337", marginTop: 0 }}>Meals</h2>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#9d174d",
                  fontWeight: "bold",
                }}
              >
                New meal
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  placeholder="Add a meal"
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #f9a8d4",
                    background: "#fff",
                  }}
                />
                <button
                  onClick={addMeal}
                  disabled={saving}
                  style={{
                    border: "none",
                    borderRadius: "12px",
                    background: "#f472b6",
                    color: "white",
                    padding: "12px 16px",
                    cursor: "pointer",
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {loading ? (
              <p style={{ color: "#9d174d" }}>Loading meals...</p>
            ) : sortedMeals.length === 0 ? (
              <div
                style={{
                  border: "1px dashed #f9a8d4",
                  background: "#fdf2f8",
                  borderRadius: "18px",
                  padding: "20px",
                  color: "#9d174d",
                }}
              >
                <p style={{ marginTop: 0 }}>No meals found yet.</p>
                <button
                  onClick={addSampleData}
                  disabled={saving}
                  style={{
                    border: "none",
                    borderRadius: "10px",
                    background: "#f472b6",
                    color: "white",
                    padding: "10px 14px",
                    cursor: "pointer",
                  }}
                >
                  Add sample meals
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {sortedMeals.map((meal) => {
                  const isActive = activeMeal?.id === meal.id;
                  const isEditing = editingMealId === meal.id;

                  return (
                    <div
                      key={meal.id}
                      style={{
                        border: "1px solid #f9a8d4",
                        borderRadius: "18px",
                        padding: "16px",
                        background:
                          "linear-gradient(to bottom right, #fce7f3, #ffe4e6)",
                      }}
                    >
                      {isEditing ? (
                        <div>
                          <div
                            style={{
                              marginBottom: "8px",
                              color: "#9d174d",
                              fontSize: "14px",
                            }}
                          >
                            Meal name
                          </div>
                          <input
                            autoFocus
                            value={editingMealName}
                            onChange={(e) => setEditingMealName(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "12px",
                              borderRadius: "12px",
                              border: "1px solid #f9a8d4",
                              marginBottom: "10px",
                            }}
                          />
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              onClick={saveMealName}
                              disabled={saving}
                              style={{
                                border: "none",
                                borderRadius: "10px",
                                background: "#f472b6",
                                color: "white",
                                padding: "10px 14px",
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditingMeal}
                              style={{
                                borderRadius: "10px",
                                border: "1px solid #f9a8d4",
                                background: "white",
                                color: "#881337",
                                padding: "10px 14px",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
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
                            <div
                              style={{
                                fontWeight: "bold",
                                color: "#881337",
                                marginBottom: "4px",
                              }}
                            >
                              {meal.name}
                            </div>
                            <div style={{ color: "#9d174d", fontSize: "13px" }}>
                              {(ingredientsByMeal[meal.id] ?? []).length} ingredient
                              {(ingredientsByMeal[meal.id] ?? []).length === 1
                                ? ""
                                : "s"}
                            </div>
                            <div
                              style={{
                                marginTop: "10px",
                                display: "inline-block",
                                background: "rgba(255,255,255,0.9)",
                                borderRadius: "999px",
                                padding: "6px 10px",
                                fontSize: "12px",
                                color: "#881337",
                              }}
                            >
                              {meal.servings} serving
                              {meal.servings === 1 ? "" : "s"}
                            </div>
                          </button>

                          <div
                            style={{
                              marginTop: "12px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                background: "white",
                                border: "1px solid #f9a8d4",
                                borderRadius: "10px",
                                padding: "8px 12px",
                                color: "#881337",
                                fontSize: "14px",
                              }}
                            >
                              {isActive ? "Selected" : "Open"}
                            </div>

                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                onClick={() => startEditingMeal(meal)}
                                style={{
                                  border: "1px solid #f9a8d4",
                                  background: "white",
                                  cursor: "pointer",
                                  color: "#881337",
                                  borderRadius: "8px",
                                  padding: "6px 10px",
                                }}
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => duplicateMeal(meal.id)}
                                disabled={saving}
                                style={{
                                  border: "1px solid #f9a8d4",
                                  background: "white",
                                  cursor: "pointer",
                                  color: "#881337",
                                  borderRadius: "8px",
                                  padding: "6px 10px",
                                }}
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => deleteMeal(meal.id)}
                                disabled={saving}
                                style={{
                                  border: "1px solid #f9a8d4",
                                  background: "white",
                                  cursor: "pointer",
                                  color: "#881337",
                                  borderRadius: "8px",
                                  padding: "6px 10px",
                                }}
                              >
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
            )}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.9)",
              borderRadius: "24px",
              padding: "20px",
              border: "1px solid #f9a8d4",
            }}
          >
            <h2 style={{ color: "#881337", marginTop: 0 }}>
              {activeMeal ? `${activeMeal.name} ingredients` : "Choose a meal"}
            </h2>

            {activeMeal ? (
              <>
                <div
                  style={{
                    border: "1px solid #f9a8d4",
                    background: "#fdf2f8",
                    borderRadius: "18px",
                    padding: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      color: "#881337",
                      fontWeight: "bold",
                      marginBottom: "6px",
                    }}
                  >
                    Default servings
                  </div>
                  <div style={{ color: "#9d174d" }}>{activeMeal.servings}</div>
                </div>

                {(ingredientsByMeal[activeMeal.id] ?? []).length === 0 ? (
                  <div
                    style={{
                      border: "1px dashed #f9a8d4",
                      background: "#fdf2f8",
                      borderRadius: "18px",
                      padding: "20px",
                      color: "#9d174d",
                    }}
                  >
                    No ingredients yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {(ingredientsByMeal[activeMeal.id] ?? []).map((ingredient) => (
                      <div
                        key={ingredient.id}
                        style={{
                          border: "1px solid #f9a8d4",
                          background: "#fdf2f8",
                          borderRadius: "18px",
                          padding: "16px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            color: "#881337",
                          }}
                        >
                          {ingredient.name}
                        </div>
                        <div
                          style={{
                            color: "#9d174d",
                            marginTop: "4px",
                          }}
                        >
                          {formatQuantity(Number(ingredient.quantity))}{" "}
                          {ingredient.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: "#9d174d" }}>No meal selected</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}