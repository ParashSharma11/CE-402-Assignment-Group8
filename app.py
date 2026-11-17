import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# ==============================================================================
# CONSTANTS & PHYSICAL CONSTANTS
# ==============================================================================
# Source: Standard Fluid Mechanics / Terzaghi, Peck, & Mesri (1996), 
# "Soil Mechanics in Engineering Practice", 3rd Ed., Wiley.
# Unit weight of water (gamma_w) = rho_w * g = 1.000 Mg/m^3 * 9.81 m/s^2 = 9.81 kN/m^3
GAMMA_W_KN_M3 = 9.81

# Source: ASTM D2487 (Standard Practice for Classification of Soils for Engineering 
# Purposes - Unified Soil Classification System) & BS 5930 (Code of Practice for 
# Ground Investigations) for visual lithology styling.
SOIL_STYLES = {
    "Clay (CL/CH)":   {"color": "#d98880", "hatch": "--"},
    "Silt (ML/MH)":   {"color": "#f5cba7", "hatch": "||"},
    "Sand (SW/SP)":   {"color": "#f9e79f", "hatch": ".."},
    "Gravel (GW/GP)": {"color": "#ccd1d1", "hatch": "oo"},
    "Peat (Pt)":      {"color": "#873600", "hatch": "xx"},
    "Rock / Bedrock": {"color": "#85929e", "hatch": "//"},
}


# ==============================================================================
# CORE GEOTECHNICAL LOGIC & VALIDATION FUNCTIONS
# ==============================================================================
def validate_and_process_profile(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    Validates stratigraphic continuity, physical parameter bounds, and computes
    derived stiffness and unit weight parameters in strict SI units (kN, kPa, m, mm).
    """
    errors = []
    processed_df = df.copy()

    # Sort layers by top depth to enforce stratigraphic order from ground surface (z = 0 m)
    # Source: EN 1997-2 (Eurocode 7: Ground Investigation and Testing), Section 2.4
    processed_df = processed_df.sort_values(by="z_top (m)").reset_index(drop=True)

    for idx, row in processed_df.iterrows():
        layer_num = idx + 1

        # Logic Block 1: Surface datum check
        # Source: Standard Geotechnical Coordinate Convention (Positive z downward from z = 0.0 m)
        if idx == 0 and not np.isclose(row["z_top (m)"], 0.0, atol=1e-3):
            errors.append(f"Layer {layer_num}: Top of first layer must start at ground surface (z_top = 0.0 m).")

        # Logic Block 2: Positive layer thickness validation
        # Equation: H_i = z_bot,i - z_top,i > 0
        # Source: Geometric stratigraphic validity (Das & Sobhan, 2018, "Principles of Geotechnical Engineering")
        if row["z_bot (m)"] <= row["z_top (m)"]:
            errors.append(
                f"Layer {layer_num}: Bottom depth ({row['z_bot (m)']} m) must exceed top depth ({row['z_top (m)']} m)."
            )

        # Logic Block 3: Stratigraphic continuity between adjacent layers (no gaps or overlaps)
        # Equation: z_top,i == z_bot,i-1
        # Source: 1D Continuum Stratigraphic Modeling (Craig's Soil Mechanics, 9th Ed., Knappett & Craig, 2019)
        if idx > 0:
            prev_bot = processed_df.loc[idx - 1, "z_bot (m)"]
            if not np.isclose(row["z_top (m)"], prev_bot, atol=1e-3):
                errors.append(
                    f"Layer {layer_num}: Depth discontinuity detected. z_top ({row['z_top (m)']} m) "
                    f"does not match previous layer z_bot ({prev_bot} m)."
                )

        # Logic Block 4: Phase relationship unit weight validation
        # Equation: gamma_sat >= gamma_moist (for degree of saturation S <= 100%)
        # Source: Phase Relationships of Soils (Das & Sobhan, 2018, Chapter 3: Weight-Volume Relationships)
        if row["gamma_sat (kN/m³)"] < row["gamma_moist (kN/m³)"]:
            errors.append(
                f"Layer {layer_num}: Saturated unit weight ({row['gamma_sat (kN/m³)']} kN/m³) "
                f"cannot be less than moist unit weight ({row['gamma_moist (kN/m³)']} kN/m³)."
            )

        # Logic Block 5: Thermodynamic bounds of Poisson's Ratio for isotropic linear elastic materials
        # Equation: 0.0 <= nu' < 0.5
        # Source: Theory of Elasticity (Timoshenko & Goodier, 1970; Bowles, 1996, "Foundation Analysis and Design")
        if not (0.0 <= row["nu_prime (-)"] < 0.499):
            errors.append(
                f"Layer {layer_num}: Effective Poisson's ratio nu' ({row['nu_prime (-)']}) "
                f"must be between 0.00 and 0.49 for drained elastic stability."
            )

    # Equation 1: Layer Thickness (m) & Thickness in (mm) for settlement integration
    # H = z_bot - z_top (m); H_mm = H * 1000 (mm)
    # Source: SI Base-to-Submultiple Unit Conversion (ISO 80000-1)
    processed_df["H (m)"] = processed_df["z_bot (m)"] - processed_df["z_top (m)"]
    processed_df["H (mm)"] = processed_df["H (m)"] * 1000.0

    # Equation 2: Submerged (Buoyant) Unit Weight (kN/m³)
    # gamma' = gamma_sat - gamma_w
    # Source: Principle of Effective Stress & Archimedes' Buoyancy in Porous Media 
    # (Terzaghi, 1943, "Theoretical Soil Mechanics", John Wiley & Sons)
    processed_df["gamma_sub (kN/m³)"] = processed_df["gamma_sat (kN/m³)"] - GAMMA_W_KN_M3

    # Equation 3: 1D Constrained (Oedometer) Modulus from Hooke's Law for Isotropic Elasticity (kPa)
    # E_oed = [E' * (1 - nu')] / [(1 + nu') * (1 - 2 * nu')]
    # Source: Poulos & Davis (1974), "Elastic Solutions for Soil and Rock Mechanics", Eq. 2.7;
    # Bowles (1996), "Foundation Analysis and Design", 5th Ed., Table 2-8.
    nu = processed_df["nu_prime (-)"]
    e_prime = processed_df["E_prime (kPa)"]
    processed_df["E_oed (kPa)"] = (e_prime * (1.0 - nu)) / ((1.0 + nu) * (1.0 - 2.0 * nu))

    # Equation 4: Coefficient of Volume Compressibility (1/kPa)
    # m_v = 1 / E_oed
    # Source: Terzaghi 1D Consolidation Theory (Terzaghi, Peck, & Mesri, 1996, Section 16.3)
    processed_df["mv (1/kPa)"] = 1.0 / processed_df["E_oed (kPa)"]

    return processed_df, errors


# ==============================================================================
# VISUALIZATION ENGINE
# ==============================================================================
def plot_soil_profile(
    df: pd.DataFrame,
    zw_measured_m: float,
    zw_design_m: float
) -> plt.Figure:
    """
    Renders a scaled 2D stratigraphic soil profile column with engineering parameter 
    annotations and distinct symbols for Measured vs. Design Water Tables.
    """
    # Logic Block 6: Canvas scaling proportional to total investigation depth
    # Source: BS 5930 / ISO 14688 Borehole Log Presentation Standards
    fig, ax = plt.subplots(figsize=(10, 7.5), dpi=120)
    max_depth = max(df["z_bot (m)"].max(), zw_measured_m, zw_design_m) * 1.05

    col_left = 0.0
    col_width = 2.5

    for idx, row in df.iterrows():
        z_top = row["z_top (m)"]
        z_bot = row["z_bot (m)"]
        thickness = row["H (m)"]
        soil_type = row["Soil Type (USCS)"]
        style = SOIL_STYLES.get(soil_type, {"color": "#d5dbdb", "hatch": ".."})

        # Draw lithology block
        # Source: Matplotlib Patch Geometry (x, y_top, width, height)
        rect = patches.Rectangle(
            (col_left, z_top),
            col_width,
            thickness,
            facecolor=style["color"],
            edgecolor="black",
            hatch=style["hatch"],
            alpha=0.85,
            linewidth=1.2
        )
        ax.add_patch(rect)

        # Draw horizon boundary line extending into parameter table
        ax.axhline(y=z_bot, color="#566573", linestyle=":", linewidth=0.9, xmin=0.0, xmax=0.95)

        # Mid-depth coordinate for placing layer annotation text
        # Equation: z_mid = 0.5 * (z_top + z_bot)
        # Source: Geometric centroid of 1D interval
        z_mid = 0.5 * (z_top + z_bot)

        # Layer ID inside borehole column
        ax.text(
            col_left + col_width / 2.0,
            z_mid,
            f"L{idx + 1}\n{soil_type}\n(H = {thickness:.2f} m)",
            ha="center",
            va="center",
            fontsize=8.5,
            fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.25", facecolor="white", edgecolor="black", alpha=0.85)
        )

        # Detailed Geotechnical Parameter Block next to layer
        # Source: Eurocode 7 (EN 1997-1, Section 2.4.5.2) Characteristic Values Summary
        param_text = (
            f"Unit Weights:  γ_moist = {row['gamma_moist (kN/m³)']:.1f} kN/m³  |  "
            f"γ_sat = {row['gamma_sat (kN/m³)']:.1f} kN/m³  |  γ' = {row['gamma_sub (kN/m³)']:.2f} kN/m³\n"
            f"Strength:      s_u = {row['su (kPa)']:.1f} kPa  |  "
            f"c' = {row['c_prime (kPa)']:.1f} kPa  |  φ' = {row['phi_prime (deg)']:.1f}°\n"
            f"Stiffness:     E' = {row['E_prime (kPa)']:,.0f} kPa  |  "
            f"ν' = {row['nu_prime (-)']:.2f}  |  E_oed = {row['E_oed (kPa)']:,.0f} kPa\n"
            f"Consolidation: e_0 = {row['e0 (-)']:.2f}  |  C_c = {row['Cc (-)']:.3f}  |  "
            f"C_r = {row['Cr (-)']:.3f}  |  OCR = {row['OCR (-)']:.2f}  |  c_v = {row['cv (mm²/s)']:.3f} mm²/s"
        )
        ax.text(
            col_left + col_width + 0.35,
            z_mid,
            param_text,
            ha="left",
            va="center",
            fontsize=8.0,
            family="monospace",
            bbox=dict(boxstyle="square,pad=0.3", facecolor="#f8f9f9", edgecolor="#bdc3c7", alpha=0.95)
        )

    # Logic Block 7: Phreatic Surface (Water Table) Graphical Representation
    # Source: ISO 710-3 & EN 1997-1 Section 2.4.4 (Geotechnical Design Water Pressure vs. Measured Water Level)
    # 1. Measured Water Table (Dashed Cyan/Blue line with inverted triangle symbol)
    ax.axhline(y=zw_measured_m, color="#2874a6", linestyle="--", linewidth=1.8, label=f"Measured WT (z_w,meas = {zw_measured_m:.2f} m)")
    ax.plot(col_left - 0.35, zw_measured_m, marker="v", markersize=10, color="#2874a6")
    ax.text(
        col_left - 0.55, zw_measured_m, f"Meas. WT\n{zw_measured_m:.2f} m",
        color="#2874a6", fontsize=8, fontweight="bold", ha="right", va="center"
    )

    # 2. Design Water Table (Solid Dark Red/Blue line with inverted triangle symbol)
    ax.axhline(y=zw_design_m, color="#c0392b", linestyle="-", linewidth=2.2, label=f"Design WT (z_w,des = {zw_design_m:.2f} m)")
    ax.plot(col_left - 0.35, zw_design_m, marker="v", markersize=10, color="#c0392b")
    ax.text(
        col_left - 0.55, zw_design_m, f"Design WT\n{zw_design_m:.2f} m",
        color="#c0392b", fontsize=8, fontweight="bold", ha="right", va="center"
    )

    # Ground surface line (z = 0.0 m)
    ax.axhline(y=0.0, color="#1b2631", linestyle="-", linewidth=2.5)
    ax.text(col_left + col_width / 2.0, -0.35, "Ground Surface (z = 0.00 m)", ha="center", va="bottom", fontweight="bold", fontsize=9)

    # Configure axes for downward-positive geotechnical depth convention
    # Source: Standard Geotechnical Depth Axis Orientation (z increases downward)
    ax.set_ylim(max_depth, -0.8)
    ax.set_xlim(-1.8, 11.5)
    ax.set_ylabel("Depth below Ground Surface, z (m)", fontsize=10, fontweight="bold")
    ax.set_xticks([])
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["bottom"].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    ax.legend(loc="lower right", frameon=True, fontsize=8.5)
    ax.set_title("Module P1: Geotechnical Soil Profile & Characteristic Parameters (SI Units)", fontsize=11, fontweight="bold", pad=12)

    plt.tight_layout()
    return fig


# ==============================================================================
# STREAMLIT USER INTERFACE (MODULE P1)
# ==============================================================================
def main():
    st.set_page_config(page_title="Geotechnical Platform - Module P1", layout="wide")
    st.title("Module P1: Stratigraphic Soil Profile & Water Table Definition")
    st.caption("Strict SI Unit Enforcement: Force = kN | Stress/Modulus = kPa | Depth/Thickness = m, mm | Unit Weight = kN/m³")

    # Sidebar: Phreatic Surface Inputs
    # Source: Eurocode 7 (EN 1997-1, Clause 2.4.5.1) - Distinction between measured groundwater 
    # level during site investigation and unfavorable design groundwater level for ULS/SLS checks.
    st.sidebar.header("Groundwater Conditions")
    zw_measured_m = st.sidebar.number_input(
        "Measured Water Table Depth, z_w,meas (m)",
        min_value=0.0,
        max_value=100.0,
        value=3.50,
        step=0.10,
        help="Depth below ground surface measured in piezometers/standpipes during investigation (m)."
    )
    zw_design_m = st.sidebar.number_input(
        "Design Water Table Depth, z_w,des (m)",
        min_value=0.0,
        max_value=100.0,
        value=1.50,
        step=0.10,
        help="Design water table depth accounting for seasonal fluctuations or flooding (EN 1997-1)."
    )
    st.sidebar.info(f"Unit weight of water fixed at $\\gamma_w = {GAMMA_W_KN_M3}\\text{{ kN/m}}^3$")

    # Default initial soil profile data
    # Source: Typical representative values from Look (2014), "Handbook of Geotechnical Investigation and Design Tables"
    if "soil_profile_df" not in st.session_state:
        st.session_state.soil_profile_df = pd.DataFrame([
            {
                "Soil Type (USCS)": "Sand (SW/SP)",
                "z_top (m)": 0.0,
                "z_bot (m)": 3.0,
                "gamma_moist (kN/m³)": 18.0,
                "gamma_sat (kN/m³)": 20.0,
                "su (kPa)": 0.0,
                "c_prime (kPa)": 0.0,
                "phi_prime (deg)": 34.0,
                "E_prime (kPa)": 25000.0,
                "nu_prime (-)": 0.30,
                "e0 (-)": 0.65,
                "Cc (-)": 0.020,
                "Cr (-)": 0.005,
                "OCR (-)": 1.0,
                "cv (mm²/s)": 10.000,
            },
            {
                "Soil Type (USCS)": "Clay (CL/CH)",
                "z_top (m)": 3.0,
                "z_bot (m)": 9.0,
                "gamma_moist (kN/m³)": 17.5,
                "gamma_sat (kN/m³)": 18.5,
                "su (kPa)": 45.0,
                "c_prime (kPa)": 5.0,
                "phi_prime (deg)": 24.0,
                "E_prime (kPa)": 8000.0,
                "nu_prime (-)": 0.35,
                "e0 (-)": 1.10,
                "Cc (-)": 0.350,
                "Cr (-)": 0.060,
                "OCR (-)": 1.5,
                "cv (mm²/s)": 0.045,
            },
            {
                "Soil Type (USCS)": "Gravel (GW/GP)",
                "z_top (m)": 9.0,
                "z_bot (m)": 14.0,
                "gamma_moist (kN/m³)": 20.0,
                "gamma_sat (kN/m³)": 21.5,
                "su (kPa)": 0.0,
                "c_prime (kPa)": 0.0,
                "phi_prime (deg)": 38.0,
                "E_prime (kPa)": 60000.0,
                "nu_prime (-)": 0.25,
                "e0 (-)": 0.45,
                "Cc (-)": 0.010,
                "Cr (-)": 0.002,
                "OCR (-)": 1.0,
                "cv (mm²/s)": 50.000,
            }
        ])

    st.subheader("1. Stratigraphic Layer Input Table")
    st.markdown("Add, delete, or modify soil layers below. Ensure depths are continuous from $z = 0.0\\text{ m}$.")

    # Configure column constraints to enforce physical bounds in UI
    edited_df = st.data_editor(
        st.session_state.soil_profile_df,
        num_rows="dynamic",
        use_container_width=True,
        column_config={
            "Soil Type (USCS)": st.column_config.SelectboxColumn(
                "Soil Type (USCS)", options=list(SOIL_STYLES.keys()), required=True
            ),
            "z_top (m)": st.column_config.NumberColumn("z_top (m)", min_value=0.0, step=0.5, format="%.2f", required=True),
            "z_bot (m)": st.column_config.NumberColumn("z_bot (m)", min_value=0.1, step=0.5, format="%.2f", required=True),
            "gamma_moist (kN/m³)": st.column_config.NumberColumn("γ_moist (kN/m³)", min_value=10.0, max_value=28.0, format="%.1f", required=True),
            "gamma_sat (kN/m³)": st.column_config.NumberColumn("γ_sat (kN/m³)", min_value=10.5, max_value=29.0, format="%.1f", required=True),
            "su (kPa)": st.column_config.NumberColumn("s_u (kPa)", min_value=0.0, max_value=5000.0, format="%.1f", required=True),
            "c_prime (kPa)": st.column_config.NumberColumn("c' (kPa)", min_value=0.0, max_value=5000.0, format="%.1f", required=True),
            "phi_prime (deg)": st.column_config.NumberColumn("φ' (deg)", min_value=0.0, max_value=55.0, format="%.1f", required=True),
            "E_prime (kPa)": st.column_config.NumberColumn("E' (kPa)", min_value=100.0, max_value=5e7, format="%.0f", required=True),
            "nu_prime (-)": st.column_config.NumberColumn("ν' (-)", min_value=0.0, max_value=0.49, step=0.01, format="%.2f", required=True),
            "e0 (-)": st.column_config.NumberColumn("e_0 (-)", min_value=0.1, max_value=10.0, step=0.05, format="%.2f", required=True),
            "Cc (-)": st.column_config.NumberColumn("C_c (-)", min_value=0.001, max_value=5.0, format="%.3f", required=True),
            "Cr (-)": st.column_config.NumberColumn("C_r (-)", min_value=0.0005, max_value=2.0, format="%.3f", required=True),
            "OCR (-)": st.column_config.NumberColumn("OCR (-)", min_value=1.0, max_value=50.0, format="%.2f", required=True),
            "cv (mm²/s)": st.column_config.NumberColumn("c_v (mm²/s)", min_value=1e-4, max_value=1000.0, format="%.3f", required=True),
        }
    )

    # Run validation and derived parameter calculations
    processed_df, validation_errors = validate_and_process_profile(edited_df)

    if validation_errors:
        for err in validation_errors:
            st.error(err)
    else:
        col_table, col_plot = st.columns([1.1, 1.2])

        with col_table:
            st.subheader("2. Derived Stiffness & Buoyant Parameters")
            display_cols = [
                "Soil Type (USCS)", "H (m)", "H (mm)",
                "gamma_sub (kN/m³)", "E_oed (kPa)", "mv (1/kPa)"
            ]
            st.dataframe(
                processed_df[display_cols].style.format({
                    "H (m)": "{:.2f}",
                    "H (mm)": "{:,.0f}",
                    "gamma_sub (kN/m³)": "{:.2f}",
                    "E_oed (kPa)": "{:,.0f}",
                    "mv (1/kPa)": "{:.2e}"
                }),
                use_container_width=True
            )

        with col_plot:
            st.subheader("3. Stratigraphic Profile Visualization")
            fig = plot_soil_profile(processed_df, zw_measured_m, zw_design_m)
            st.pyplot(fig)


if __name__ == "__main__":
    main()