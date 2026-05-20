from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")


RecipeInput = dict[str, Any]


def ingredient(position: int, quantity: str, unit: str, name: str) -> dict[str, Any]:
    return {
        "id": f"ing-{position + 1}",
        "position": position,
        "quantity": quantity,
        "unit": unit,
        "name": name,
    }


def step(position: int, instruction: str) -> dict[str, Any]:
    return {
        "id": f"step-{position + 1}",
        "position": position,
        "instruction": instruction,
        "photo_paths": [],
        "photo_urls": [],
    }


RECIPES: list[RecipeInput] = [
    {
        "title": "Garden Vegetable Frittata",
        "description": "A tender skillet frittata with eggs, zucchini, peppers, herbs, and a little cheese.",
        "cover_image_url": "https://images.unsplash.com/photo-1510693206972-df098062cb71?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 10,
        "cook_time_minutes": 18,
        "additional_time_minutes": 5,
        "servings": 4,
        "difficulty": "Easy",
        "tags": ["Breakfast", "Vegetarian", "Eggs", "Zucchini"],
        "ingredients": [
            ("8", "", "large eggs"),
            ("1/4", "cup", "whole milk"),
            ("1", "cup", "diced zucchini"),
            ("1/2", "cup", "diced bell pepper"),
            ("1/3", "cup", "crumbled feta"),
            ("2", "tbsp", "chopped parsley"),
            ("1", "tbsp", "olive oil"),
            ("1/2", "tsp", "kosher salt"),
        ],
        "steps": [
            "Heat the oven to 375 F and whisk eggs, milk, salt, and pepper in a bowl.",
            "Warm olive oil in an oven-safe skillet and saute zucchini and pepper until just tender.",
            "Pour in the egg mixture, scatter feta and parsley over the top, and cook for 2 minutes.",
            "Transfer the skillet to the oven and bake until the center is set.",
            "Rest for 5 minutes, then slice and serve warm.",
        ],
    },
    {
        "title": "Strawberry Overnight Oats",
        "description": "Creamy oats chilled with yogurt, strawberries, chia seeds, and honey for a fast breakfast.",
        "cover_image_url": "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 10,
        "cook_time_minutes": 0,
        "additional_time_minutes": 480,
        "servings": 2,
        "difficulty": "Easy",
        "tags": ["Breakfast", "Snack", "Strawberry", "Make Ahead"],
        "ingredients": [
            ("1", "cup", "rolled oats"),
            ("1", "cup", "milk"),
            ("1/2", "cup", "plain Greek yogurt"),
            ("1", "cup", "sliced strawberries"),
            ("1", "tbsp", "chia seeds"),
            ("1", "tbsp", "honey"),
            ("1/2", "tsp", "vanilla extract"),
        ],
        "steps": [
            "Stir oats, milk, yogurt, chia seeds, honey, and vanilla together in a jar.",
            "Fold in half of the strawberries and cover tightly.",
            "Refrigerate overnight or at least 4 hours.",
            "Top with the remaining strawberries before serving.",
        ],
    },
    {
        "title": "Avocado Tomato Toast",
        "description": "Crisp toast topped with lemony avocado, juicy tomatoes, herbs, and chili flakes.",
        "cover_image_url": "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 8,
        "cook_time_minutes": 4,
        "additional_time_minutes": 0,
        "servings": 2,
        "difficulty": "Easy",
        "tags": ["Breakfast", "Lunch", "Vegetarian", "Avocado"],
        "ingredients": [
            ("2", "slices", "sourdough bread"),
            ("1", "", "ripe avocado"),
            ("1", "tbsp", "lemon juice"),
            ("1", "cup", "cherry tomatoes"),
            ("1", "tbsp", "chopped chives"),
            ("1/4", "tsp", "red pepper flakes"),
            ("1/4", "tsp", "kosher salt"),
        ],
        "steps": [
            "Toast the bread until crisp and golden.",
            "Mash avocado with lemon juice, salt, and pepper.",
            "Spread avocado over toast and top with halved cherry tomatoes.",
            "Finish with chives, red pepper flakes, and a drizzle of olive oil.",
        ],
    },
    {
        "title": "Roasted Tomato Basil Pasta",
        "description": "Sweet roasted tomatoes and garlic tossed with pasta, basil, and parmesan.",
        "cover_image_url": "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 10,
        "cook_time_minutes": 35,
        "additional_time_minutes": 0,
        "servings": 4,
        "difficulty": "Medium",
        "tags": ["Dinner", "Pasta", "Tomato", "Vegetarian"],
        "ingredients": [
            ("1", "lb", "cherry tomatoes"),
            ("4", "cloves", "garlic"),
            ("3", "tbsp", "olive oil"),
            ("12", "oz", "spaghetti"),
            ("1/2", "cup", "grated parmesan"),
            ("1/2", "cup", "fresh basil leaves"),
            ("1/2", "tsp", "kosher salt"),
        ],
        "steps": [
            "Heat the oven to 425 F and place tomatoes and garlic on a sheet pan.",
            "Toss with olive oil, salt, and pepper, then roast until tomatoes collapse.",
            "Boil pasta until al dente, reserving 1 cup of pasta water.",
            "Mash roasted garlic into the tomatoes and toss with pasta, parmesan, and basil.",
            "Loosen with reserved pasta water as needed and serve immediately.",
        ],
    },
    {
        "title": "Chicken Lettuce Wraps",
        "description": "Savory ground chicken with ginger, garlic, water chestnuts, and crisp lettuce cups.",
        "cover_image_url": "https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 15,
        "cook_time_minutes": 12,
        "additional_time_minutes": 0,
        "servings": 4,
        "difficulty": "Easy",
        "tags": ["Lunch", "Dinner", "Chicken", "Low Carb"],
        "ingredients": [
            ("1", "lb", "ground chicken"),
            ("1", "tbsp", "neutral oil"),
            ("2", "cloves", "garlic"),
            ("1", "tbsp", "grated ginger"),
            ("2", "tbsp", "soy sauce"),
            ("1", "tbsp", "rice vinegar"),
            ("1", "cup", "diced water chestnuts"),
            ("1", "head", "butter lettuce"),
        ],
        "steps": [
            "Heat oil in a skillet and cook chicken until browned and cooked through.",
            "Stir in garlic and ginger and cook until fragrant.",
            "Add soy sauce, rice vinegar, and water chestnuts, then simmer for 2 minutes.",
            "Spoon the filling into lettuce leaves and serve with extra herbs or chili crisp.",
        ],
    },
    {
        "title": "Lemon Herb Salmon Bowls",
        "description": "Flaky salmon served over rice with cucumber, greens, lemon yogurt sauce, and herbs.",
        "cover_image_url": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 15,
        "cook_time_minutes": 14,
        "additional_time_minutes": 0,
        "servings": 4,
        "difficulty": "Medium",
        "tags": ["Lunch", "Dinner", "Seafood", "Rice Bowl"],
        "ingredients": [
            ("4", "fillets", "salmon"),
            ("2", "cups", "cooked rice"),
            ("1", "", "cucumber"),
            ("4", "cups", "mixed greens"),
            ("1/2", "cup", "plain yogurt"),
            ("1", "", "lemon"),
            ("2", "tbsp", "chopped dill"),
            ("1", "tbsp", "olive oil"),
        ],
        "steps": [
            "Season salmon with olive oil, salt, pepper, and half of the lemon zest.",
            "Bake at 400 F until the salmon flakes easily with a fork.",
            "Stir yogurt with lemon juice, remaining zest, dill, salt, and pepper.",
            "Divide rice, greens, cucumber, and salmon among bowls.",
            "Spoon lemon yogurt sauce over each bowl before serving.",
        ],
    },
    {
        "title": "Black Bean Sweet Potato Tacos",
        "description": "Roasted sweet potatoes and seasoned black beans tucked into warm tortillas with lime crema.",
        "cover_image_url": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 15,
        "cook_time_minutes": 25,
        "additional_time_minutes": 0,
        "servings": 4,
        "difficulty": "Easy",
        "tags": ["Dinner", "Lunch", "Vegetarian", "Tacos"],
        "ingredients": [
            ("2", "", "sweet potatoes"),
            ("1", "can", "black beans"),
            ("8", "", "corn tortillas"),
            ("1", "tsp", "chili powder"),
            ("1/2", "tsp", "cumin"),
            ("1/3", "cup", "sour cream"),
            ("1", "", "lime"),
            ("1/2", "cup", "crumbled cotija"),
        ],
        "steps": [
            "Dice sweet potatoes and toss with oil, chili powder, cumin, and salt.",
            "Roast at 425 F until browned and tender.",
            "Warm black beans in a small pan with a splash of water and a pinch of salt.",
            "Stir sour cream with lime juice to make a quick crema.",
            "Fill warm tortillas with sweet potatoes, beans, crema, and cotija.",
        ],
    },
    {
        "title": "Turkey Pesto Panini",
        "description": "A hot pressed sandwich with turkey, pesto, tomato, mozzarella, and crisp bread.",
        "cover_image_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 8,
        "cook_time_minutes": 8,
        "additional_time_minutes": 0,
        "servings": 2,
        "difficulty": "Easy",
        "tags": ["Lunch", "Sandwich", "Turkey", "Tomato"],
        "ingredients": [
            ("4", "slices", "ciabatta or sourdough"),
            ("6", "oz", "sliced turkey"),
            ("2", "tbsp", "pesto"),
            ("1", "", "tomato"),
            ("4", "oz", "fresh mozzarella"),
            ("1", "tbsp", "olive oil"),
        ],
        "steps": [
            "Spread pesto on the bread and layer turkey, tomato, and mozzarella.",
            "Brush the outside of the sandwiches lightly with olive oil.",
            "Press in a panini press or hot skillet until the bread is crisp and cheese melts.",
            "Slice and serve warm.",
        ],
    },
    {
        "title": "Cucumber Chickpea Salad",
        "description": "A bright no-cook salad with chickpeas, cucumber, herbs, feta, and lemon vinaigrette.",
        "cover_image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 15,
        "cook_time_minutes": 0,
        "additional_time_minutes": 10,
        "servings": 4,
        "difficulty": "Easy",
        "tags": ["Lunch", "Snack", "Salad", "Vegetarian"],
        "ingredients": [
            ("1", "can", "chickpeas"),
            ("1", "", "English cucumber"),
            ("1", "cup", "cherry tomatoes"),
            ("1/2", "cup", "crumbled feta"),
            ("1/4", "cup", "chopped parsley"),
            ("2", "tbsp", "olive oil"),
            ("1", "", "lemon"),
            ("1/2", "tsp", "kosher salt"),
        ],
        "steps": [
            "Drain and rinse chickpeas, then place them in a large bowl.",
            "Add diced cucumber, halved tomatoes, feta, and parsley.",
            "Whisk olive oil, lemon juice, salt, and pepper.",
            "Toss the salad with dressing and rest for 10 minutes before serving.",
        ],
    },
    {
        "title": "Miso Mushroom Ramen",
        "description": "A cozy noodle bowl with miso broth, mushrooms, greens, scallions, and soft eggs.",
        "cover_image_url": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 15,
        "cook_time_minutes": 20,
        "additional_time_minutes": 0,
        "servings": 2,
        "difficulty": "Medium",
        "tags": ["Dinner", "Soup", "Mushroom", "Noodles"],
        "ingredients": [
            ("4", "cups", "vegetable broth"),
            ("2", "tbsp", "white miso"),
            ("6", "oz", "ramen noodles"),
            ("8", "oz", "mushrooms"),
            ("2", "cups", "baby spinach"),
            ("2", "", "eggs"),
            ("2", "", "scallions"),
            ("1", "tsp", "sesame oil"),
        ],
        "steps": [
            "Soft-boil eggs for 7 minutes, then cool, peel, and halve.",
            "Saute sliced mushrooms in sesame oil until browned.",
            "Simmer broth, whisk in miso off the heat, and add spinach to wilt.",
            "Cook noodles according to package directions.",
            "Assemble noodles, broth, mushrooms, eggs, and sliced scallions in bowls.",
        ],
    },
    {
        "title": "Apple Cheddar Snack Plate",
        "description": "A simple snack plate with crisp apples, cheddar, nuts, crackers, and honey.",
        "cover_image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 10,
        "cook_time_minutes": 0,
        "additional_time_minutes": 0,
        "servings": 2,
        "difficulty": "Easy",
        "tags": ["Snack", "Apple", "No Cook", "Vegetarian"],
        "ingredients": [
            ("2", "", "apples"),
            ("4", "oz", "sharp cheddar"),
            ("1/3", "cup", "almonds"),
            ("12", "", "whole grain crackers"),
            ("1", "tbsp", "honey"),
            ("1", "pinch", "flaky salt"),
        ],
        "steps": [
            "Slice apples and cheddar into bite-size pieces.",
            "Arrange apples, cheddar, almonds, and crackers on a plate.",
            "Drizzle apples lightly with honey and finish with flaky salt.",
        ],
    },
    {
        "title": "Peanut Butter Banana Smoothie",
        "description": "A thick, creamy smoothie with banana, peanut butter, oats, milk, and cinnamon.",
        "cover_image_url": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 5,
        "cook_time_minutes": 0,
        "additional_time_minutes": 0,
        "servings": 2,
        "difficulty": "Easy",
        "tags": ["Breakfast", "Snack", "Smoothie", "Banana"],
        "ingredients": [
            ("2", "", "bananas"),
            ("2", "tbsp", "peanut butter"),
            ("1 1/2", "cups", "milk"),
            ("1/4", "cup", "rolled oats"),
            ("1", "tbsp", "honey"),
            ("1/4", "tsp", "cinnamon"),
            ("1", "cup", "ice"),
        ],
        "steps": [
            "Add bananas, peanut butter, milk, oats, honey, cinnamon, and ice to a blender.",
            "Blend until completely smooth.",
            "Pour into glasses and serve right away.",
        ],
    },
    {
        "title": "Beef and Broccoli Stir Fry",
        "description": "Tender beef, crisp broccoli, and a glossy garlic-ginger sauce served over rice.",
        "cover_image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 20,
        "cook_time_minutes": 12,
        "additional_time_minutes": 0,
        "servings": 4,
        "difficulty": "Medium",
        "tags": ["Dinner", "Beef", "Broccoli", "Stir Fry"],
        "ingredients": [
            ("1", "lb", "flank steak"),
            ("4", "cups", "broccoli florets"),
            ("3", "tbsp", "soy sauce"),
            ("1", "tbsp", "cornstarch"),
            ("2", "cloves", "garlic"),
            ("1", "tbsp", "grated ginger"),
            ("1", "tbsp", "brown sugar"),
            ("2", "tbsp", "neutral oil"),
        ],
        "steps": [
            "Slice steak thinly and toss with 1 tablespoon soy sauce and cornstarch.",
            "Whisk remaining soy sauce with garlic, ginger, brown sugar, and 1/4 cup water.",
            "Sear beef in a hot skillet, then transfer to a plate.",
            "Stir-fry broccoli until bright green and crisp-tender.",
            "Return beef to the pan, add sauce, and cook until glossy.",
        ],
    },
    {
        "title": "Caprese Grain Bowl",
        "description": "Farro, tomatoes, mozzarella, basil, and balsamic vinaigrette in a hearty bowl.",
        "cover_image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 12,
        "cook_time_minutes": 25,
        "additional_time_minutes": 5,
        "servings": 4,
        "difficulty": "Easy",
        "tags": ["Lunch", "Vegetarian", "Tomato", "Grain Bowl"],
        "ingredients": [
            ("1", "cup", "farro"),
            ("2", "cups", "cherry tomatoes"),
            ("8", "oz", "fresh mozzarella"),
            ("1/2", "cup", "fresh basil"),
            ("2", "tbsp", "balsamic vinegar"),
            ("3", "tbsp", "olive oil"),
            ("1/2", "tsp", "kosher salt"),
        ],
        "steps": [
            "Cook farro in salted water until tender, then drain and cool slightly.",
            "Halve tomatoes and tear mozzarella into bite-size pieces.",
            "Whisk balsamic vinegar, olive oil, salt, and pepper.",
            "Toss farro with tomatoes, mozzarella, basil, and dressing.",
            "Rest for 5 minutes before serving.",
        ],
    },
    {
        "title": "Roasted Carrot Hummus Toasts",
        "description": "Toasted bread spread with hummus and topped with cumin-roasted carrots and herbs.",
        "cover_image_url": "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 10,
        "cook_time_minutes": 25,
        "additional_time_minutes": 0,
        "servings": 4,
        "difficulty": "Easy",
        "tags": ["Lunch", "Snack", "Vegetarian", "Carrot"],
        "ingredients": [
            ("1", "lb", "carrots"),
            ("1", "tsp", "ground cumin"),
            ("2", "tbsp", "olive oil"),
            ("1", "cup", "hummus"),
            ("4", "slices", "country bread"),
            ("2", "tbsp", "chopped cilantro"),
            ("1", "tbsp", "lemon juice"),
        ],
        "steps": [
            "Cut carrots into sticks and toss with cumin, olive oil, salt, and pepper.",
            "Roast at 425 F until browned and tender.",
            "Toast the bread until crisp.",
            "Spread hummus on each toast, top with carrots, cilantro, and lemon juice.",
        ],
    },
    {
        "title": "Shrimp Corn Chowder",
        "description": "A creamy chowder with sweet corn, potatoes, shrimp, thyme, and scallions.",
        "cover_image_url": "https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 15,
        "cook_time_minutes": 30,
        "additional_time_minutes": 0,
        "servings": 4,
        "difficulty": "Medium",
        "tags": ["Dinner", "Soup", "Seafood", "Corn"],
        "ingredients": [
            ("1", "lb", "shrimp"),
            ("3", "cups", "corn kernels"),
            ("2", "", "Yukon gold potatoes"),
            ("1", "", "yellow onion"),
            ("3", "cups", "chicken broth"),
            ("1", "cup", "half-and-half"),
            ("1", "tsp", "fresh thyme"),
            ("2", "", "scallions"),
        ],
        "steps": [
            "Saute onion in a soup pot until softened.",
            "Add diced potatoes, corn, broth, thyme, salt, and pepper, then simmer until potatoes are tender.",
            "Stir in half-and-half and shrimp.",
            "Cook until shrimp are pink and just cooked through.",
            "Top bowls with sliced scallions.",
        ],
    },
    {
        "title": "Blueberry Lemon Yogurt Parfait",
        "description": "Layers of Greek yogurt, blueberries, lemon zest, granola, and a touch of maple.",
        "cover_image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 8,
        "cook_time_minutes": 0,
        "additional_time_minutes": 0,
        "servings": 2,
        "difficulty": "Easy",
        "tags": ["Breakfast", "Snack", "Blueberry", "No Cook"],
        "ingredients": [
            ("1 1/2", "cups", "Greek yogurt"),
            ("1", "cup", "blueberries"),
            ("1/2", "cup", "granola"),
            ("1", "tbsp", "maple syrup"),
            ("1", "tsp", "lemon zest"),
            ("1", "tbsp", "lemon juice"),
        ],
        "steps": [
            "Stir yogurt with maple syrup, lemon zest, and lemon juice.",
            "Layer yogurt, blueberries, and granola in two glasses.",
            "Serve immediately for crunchy granola or chill for up to 2 hours.",
        ],
    },
    {
        "title": "Herbed Chicken Rice Soup",
        "description": "A comforting soup with shredded chicken, rice, carrots, celery, and fresh herbs.",
        "cover_image_url": "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 15,
        "cook_time_minutes": 35,
        "additional_time_minutes": 0,
        "servings": 6,
        "difficulty": "Easy",
        "tags": ["Dinner", "Lunch", "Soup", "Chicken"],
        "ingredients": [
            ("1", "tbsp", "olive oil"),
            ("1", "", "yellow onion"),
            ("2", "", "carrots"),
            ("2", "stalks", "celery"),
            ("6", "cups", "chicken broth"),
            ("1", "cup", "cooked shredded chicken"),
            ("3/4", "cup", "white rice"),
            ("2", "tbsp", "chopped parsley"),
        ],
        "steps": [
            "Saute onion, carrots, and celery in olive oil until softened.",
            "Add broth and rice, then simmer until rice is tender.",
            "Stir in shredded chicken and warm through.",
            "Finish with parsley, salt, and pepper.",
        ],
    },
    {
        "title": "Spinach Feta Stuffed Peppers",
        "description": "Bell peppers filled with quinoa, spinach, feta, tomatoes, and herbs.",
        "cover_image_url": "https://images.unsplash.com/photo-1580959375944-abd7e991f971?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 20,
        "cook_time_minutes": 35,
        "additional_time_minutes": 5,
        "servings": 4,
        "difficulty": "Medium",
        "tags": ["Dinner", "Vegetarian", "Pepper", "Quinoa"],
        "ingredients": [
            ("4", "", "bell peppers"),
            ("2", "cups", "cooked quinoa"),
            ("3", "cups", "baby spinach"),
            ("1", "cup", "diced tomatoes"),
            ("3/4", "cup", "crumbled feta"),
            ("1", "tbsp", "olive oil"),
            ("1", "tsp", "dried oregano"),
        ],
        "steps": [
            "Halve bell peppers and remove seeds.",
            "Saute spinach in olive oil until wilted.",
            "Mix quinoa, spinach, tomatoes, feta, oregano, salt, and pepper.",
            "Fill peppers with the quinoa mixture.",
            "Bake at 375 F until peppers are tender, then rest for 5 minutes.",
        ],
    },
    {
        "title": "Pork Tenderloin with Apple Slaw",
        "description": "Seared pork tenderloin served with a crisp apple, cabbage, and mustard slaw.",
        "cover_image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 20,
        "cook_time_minutes": 25,
        "additional_time_minutes": 10,
        "servings": 4,
        "difficulty": "Medium",
        "tags": ["Dinner", "Pork", "Apple", "Cabbage"],
        "ingredients": [
            ("1 1/2", "lb", "pork tenderloin"),
            ("2", "tbsp", "olive oil"),
            ("1", "tsp", "smoked paprika"),
            ("2", "", "apples"),
            ("3", "cups", "shredded cabbage"),
            ("1", "tbsp", "Dijon mustard"),
            ("2", "tbsp", "apple cider vinegar"),
            ("1", "tbsp", "honey"),
        ],
        "steps": [
            "Season pork with smoked paprika, salt, and pepper.",
            "Sear pork in olive oil, then roast at 400 F until cooked through.",
            "Rest pork for 10 minutes before slicing.",
            "Toss apples and cabbage with mustard, vinegar, honey, and olive oil.",
            "Serve sliced pork with apple slaw.",
        ],
    },
    {
        "title": "Mediterranean Tuna Pita",
        "description": "A quick tuna salad pita with cucumber, tomatoes, olives, herbs, and yogurt dressing.",
        "cover_image_url": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=1200&auto=format&fit=crop",
        "prep_time_minutes": 12,
        "cook_time_minutes": 0,
        "additional_time_minutes": 0,
        "servings": 2,
        "difficulty": "Easy",
        "tags": ["Lunch", "No Cook", "Tuna", "Pita"],
        "ingredients": [
            ("2", "cans", "tuna"),
            ("1/3", "cup", "plain Greek yogurt"),
            ("1", "tbsp", "lemon juice"),
            ("1/2", "cup", "diced cucumber"),
            ("1/2", "cup", "cherry tomatoes"),
            ("1/4", "cup", "sliced olives"),
            ("2", "", "pitas"),
            ("2", "tbsp", "chopped parsley"),
        ],
        "steps": [
            "Flake tuna in a bowl and stir in yogurt, lemon juice, salt, and pepper.",
            "Fold in cucumber, tomatoes, olives, and parsley.",
            "Warm pitas briefly if desired.",
            "Fill pitas with tuna salad and serve.",
        ],
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed the Supabase recipes table with realistic recipe data.")
    parser.add_argument(
        "--user-id",
        default=os.getenv("SEED_RECIPE_USER_ID"),
        help="Supabase auth user id to assign as recipe owner. Defaults to SEED_RECIPE_USER_ID.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only insert the first N seed recipes.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be inserted without writing to Supabase.",
    )
    return parser.parse_args()


def get_supabase_client() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

    if not supabase_url or not service_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")

    return create_client(supabase_url, service_key)


def build_recipe_payload(recipe: RecipeInput, user_id: str, now: str) -> dict[str, Any]:
    cover_image_url = recipe["cover_image_url"]
    ingredients = [
        ingredient(index, quantity, unit, name)
        for index, (quantity, unit, name) in enumerate(recipe["ingredients"])
    ]
    steps = [step(index, instruction) for index, instruction in enumerate(recipe["steps"])]
    total_time = (
        int(recipe["prep_time_minutes"])
        + int(recipe["cook_time_minutes"])
        + int(recipe["additional_time_minutes"])
    )

    return {
        "user_id": user_id,
        "title": recipe["title"],
        "description": recipe["description"],
        "cover_image_url": cover_image_url,
        "cover_image_path": None,
        "cover_media": [
            {
                "path": None,
                "url": cover_image_url,
                "type": "image",
                "position": 0,
            }
        ],
        "prep_time_minutes": recipe["prep_time_minutes"],
        "cook_time_minutes": recipe["cook_time_minutes"],
        "additional_time_minutes": recipe["additional_time_minutes"],
        "total_time_minutes": total_time,
        "servings": recipe["servings"],
        "ingredients": ingredients,
        "steps": steps,
        "created_at": now,
        "updated_at": now,
        "difficulty": recipe["difficulty"],
        "tags": recipe["tags"],
    }


def fetch_existing_titles(supabase: Client, user_id: str) -> set[str]:
    response = (
        supabase.table("recipes")
        .select("title")
        .eq("user_id", user_id)
        .limit(1000)
        .execute()
    )
    return {
        row["title"].strip().casefold()
        for row in response.data or []
        if isinstance(row.get("title"), str)
    }


def main() -> None:
    args = parse_args()
    selected_recipes = RECIPES[: args.limit] if args.limit else RECIPES

    if not args.user_id:
        raise SystemExit("Provide --user-id or set SEED_RECIPE_USER_ID in backend/.env.")

    now = datetime.now(timezone.utc).isoformat()
    payloads = [build_recipe_payload(recipe, args.user_id, now) for recipe in selected_recipes]

    if args.dry_run:
        for payload in payloads:
            print(f"Would insert: {payload['title']} ({payload['total_time_minutes']} min)")
        print(f"Dry run complete. {len(payloads)} recipe(s) prepared.")
        return

    supabase = get_supabase_client()
    existing_titles = fetch_existing_titles(supabase, args.user_id)
    missing_payloads = [
        payload
        for payload in payloads
        if payload["title"].strip().casefold() not in existing_titles
    ]

    if not missing_payloads:
        print("No recipes inserted. All selected seed recipes already exist for this user.")
        return

    response = supabase.table("recipes").insert(missing_payloads).execute()
    inserted_count = len(response.data or missing_payloads)

    print(f"Inserted {inserted_count} recipe(s).")
    for payload in missing_payloads:
        print(f"- {payload['title']}")


if __name__ == "__main__":
    main()
