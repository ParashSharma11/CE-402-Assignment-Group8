import streamlit as st
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# ==============================================================================
# CONSTANTS & PHYSICAL PARAMETERS (Modules P1 & P2)
# ==============================================================================
# Source: Standard Fluid Mechanics / Terzaghi, Peck, & Mesri (1996)
GAMMA_W_KN_M3 = 9.81

# Source: ASTM D2487 & BS 5930 for visual lithology styling.
SOIL_STYLES = {
    "Clay (CL/CH)":   {"color": "#d98880", "hatch": "--"},
    "Silt (ML/MH)":   {"color": "#f5cba7", "hatch": "||"},
    "Sand (SW/SP)":   {"color": "#f9e79f", "hatch": ".."},
    "Gravel (GW/GP)": {"color": "#ccd1d1", "hatch": "oo"},
    "Peat (Pt)":      {"color": "#873600", "hatch": "xx"},
    "Rock / Bedrock": {"color": "#85929e", "hatch": "//"},
}

# Standard IS 1498 Soil Classification sets for applying IS 2131 corrections
COHESIONLESS_SOILS = ["GW", "GP", "GM", "GC", "SW", "SP", "SM", "SC"]
FINE_SANDS_SILTS = ["SM", "ML", "SP-SM", "SC-SM", "MI"]


# ==============================================================================
# MODULE P1: CORE GEOTECHNICAL LOGIC & VALIDATION FUNCTIONS
# ==============================================================================
def validate_and_process_profile(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    Validates stratigraphic continuity, physical parameter bounds, and computes
    derived stiffness and unit weight parameters in strict SI units (kN, kPa, m, mm).
    """
    errors = []
    processed_df = df.copy()

    # Sort layers by top depth to enforce stratigraphic order from ground surface
    processed_df = processed_df.sort_values(by="z_top (m)").reset_index(drop=True)

    for idx, row in processed_df.iterrows():
        layer_num = idx + 1
        if idx == 0 and not np.isclose(row["z_top (m)"], 0.0, atol=1e-3):
            errors.append(f"Layer {layer_num}: Top of first layer must start at ground surface (z_top = 0.0 m).")
        if row["z_bot (m)"] <= row["z_top (m)"]:
            errors.append(f"Layer {layer_num}: Bottom depth ({row['z_bot (m)']} m) must exceed top depth ({row['z_top (m)']} m).")
        if idx > 0:
            prev_bot = processed_df.loc[idx - 1, "z_bot (m)"]
            if not np.isclose(row["z_top (m)"], prev_bot, atol=1e-3):
                errors.append(f"Layer {layer_num}: Depth discontinuity detected. z_top ({row['z_top (m)']} m) does not match previous layer z_bot ({prev_bot} m).")
        if row["gamma_sat (kN/m³)"] < row["gamma_moist (kN/m³)"]:
            errors.append(f"Layer {layer_num}: Saturated unit weight cannot be less than moist unit weight.")
        if not (0.0 <= row["nu_prime (-)"] < 0.499):
            errors.append(f"Layer {layer_num}: Effective Poisson's ratio nu' must be between 0.00 and 0.49.")

    processed_df["H (m)"] = processed_df["z_bot (m)"] - processed_df["z_top (m)"]
    processed_df["H (mm)"] = processed_df["H (m)"] * 1000.0
    processed_df["gamma_sub (kN/m³)"] = processed_df["gamma_sat (kN/m³)"] - GAMMA_W_KN_M3
    
    nu = processed_df["nu_prime (-)"]
    e_prime = processed_df["E_prime (kPa)"]
    processed_df["E_oed (kPa)"] = (e_prime * (1.0 - nu)) / ((1.0 + nu) * (1.0 - 2.0 * nu))
    processed_df["mv (1/kPa)"] = 1.0 / processed_df["E_oed (kPa)"]

    return processed_df, errors


def plot_soil_profile(df: pd.DataFrame, zw_measured_m: float, zw_design_m: float) -> plt.Figure:
    """Renders a scaled 2D stratigraphic soil profile column."""
    fig, ax = plt.subplots(figsize=(10, 7.5), dpi=120)
    max_depth = max(df["z_bot (m)"].max(), zw_measured_m, zw_design_m) * 1.05
    col_left, col_width = 0.0, 2.5

    for idx, row in df.iterrows():
        z_top = row["z_top (m)"]
        z_bot = row["z_bot (m)"]
        thickness = row["H (m)"]
        soil_type = row["Soil Type (USCS)"]
        style = SOIL_STYLES.get(soil_type, {"color": "#d5dbdb", "hatch": ".."})

        rect = patches.Rectangle((col_left, z_top), col_width, thickness, facecolor=style["color"], edgecolor="black", hatch=style["hatch"], alpha=0.85, linewidth=1.2)
        ax.add_patch(rect)
        ax.axhline(y=z_bot, color="#566573", linestyle=":", linewidth=0.9, xmin=0.0, xmax=0.95)
        
        z_mid = 0.5 * (z_top + z_bot)
        ax.text(col_left + col_width / 2.0, z_mid, f"L{idx + 1}\n{soil_type}\n(H = {thickness:.2f} m)", ha="center", va="center", fontsize=8.5, fontweight="bold", bbox=dict(boxstyle="round,pad=0.25", facecolor="white", edgecolor="black", alpha=0.85))

        param_text = (
            f"Unit Weights:  γ_moist = {row['gamma_moist (kN/m³)']:.1f} kN/m³  |  γ_sat = {row['gamma_sat (kN/m³)']:.1f} kN/m³  |  γ' = {row['gamma_sub (kN/m³)']:.2f} kN/m³\n"
            f"Strength:      s_u = {row['su (kPa)']:.1f} kPa  |  c' = {row['c_prime (kPa)']:.1f} kPa  |  φ' = {row['phi_prime (deg)']:.1f}°\n"
            f"Stiffness:     E' = {row['E_prime (kPa)']:,.0f} kPa  |  ν' = {row['nu_prime (-)']:.2f}  |  E_oed = {row['E_oed (kPa)']:,.0f} kPa\n"
            f"Consolidation: e_0 = {row['e0 (-)']:.2f}  |  C_c = {row['Cc (-)']:.3f}  |  C_r = {row['Cr (-)']:.3f}  |  OCR = {row['OCR (-)']:.2f}  |  c_v = {row['cv (mm²/s)']:.3f} mm²/s"
        )
        ax.text(col_left + col_width + 0.35, z_mid, param_text, ha="left", va="center", fontsize=8.0, family="monospace", bbox=dict(boxstyle="square,pad=0.3", facecolor="#f8f9f9", edgecolor="#bdc3c7", alpha=0.95))

    ax.axhline(y=zw_measured_m, color="#2874a6", linestyle="--", linewidth=1.8, label=f"Measured WT (z_w,meas = {zw_measured_m:.2f} m)")
    ax.plot(col_left - 0.35, zw_measured_m, marker="v", markersize=10, color="#2874a6")
    ax.text(col_left - 0.55, zw_measured_m, f"Meas. WT\n{zw_measured_m:.2f} m", color="#2874a6", fontsize=8, fontweight="bold", ha="right", va="center")

    ax.axhline(y=zw_design_m, color="#c0392b", linestyle="-", linewidth=2.2, label=f"Design WT (z_w,des = {zw_design_m:.2f} m)")
    ax.plot(col_left - 0.35, zw_design_m, marker="v", markersize=10, color="#c0392b")
    ax.text(col_left - 0.55, zw_design_m, f"Design WT\n{zw_design_m:.2f} m", color="#c0392b", fontsize=8, fontweight="bold", ha="right", va="center")

    ax.axhline(y=0.0, color="#1b2631", linestyle="-", linewidth=2.5)
    ax.text(col_left + col_width / 2.0, -0.35, "Ground Surface (z = 0.00 m)", ha="center", va="bottom", fontweight="bold", fontsize=9)

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
# MODULE P2: SPT CORRECTION LOGIC
# ==============================================================================
def calculate_effective_overburden(z_test: float, zw: float, profile_df: pd.DataFrame) -> float:
    """
    Calculates the effective overburden pressure (sigma_v_prime) in kPa at a specific test depth
    by integrating through the layered profile defined in Module P1.
    """
    sigma_v_prime = 0.0
    profile_df = profile_df.sort_values(by="z_top (m)")

    for _, layer in profile_df.iterrows():
        z_top = layer["z_top (m)"]
        z_bot = layer["z_bot (m)"]
        gamma_m = layer["gamma_moist (kN/m³)"]
        gamma_sat = layer["gamma_sat (kN/m³)"]
        
        if z_top >= z_test:
            break
            
        z_bot_eff = min(z_bot, z_test)
        
        if z_bot_eff <= zw:
            dz = z_bot_eff - z_top
            sigma_v_prime += dz * gamma_m
        elif z_top >= zw:
            dz = z_bot_eff - z_top
            gamma_sub = gamma_sat - GAMMA_W_KN_M3
            sigma_v_prime += dz * gamma_sub
        else:
            dz_above = zw - z_top
            dz_below = z_bot_eff - zw
            gamma_sub = gamma_sat - GAMMA_W_KN_M3
            sigma_v_prime += dz_above * gamma_m
            sigma_v_prime += dz_below * gamma_sub
            
    return sigma_v_prime


def get_overburden_factor(sigma_v_prime: float) -> float:
    """Calculates the overburden correction factor (Cn) per IS 2131:1981."""
    if sigma_v_prime <= 25.0:
        return 2.0
    cn = 0.77 * np.log10(2000.0 / sigma_v_prime)
    return min(cn, 2.0)


def apply_spt_corrections(spt_df: pd.DataFrame, profile_df: pd.DataFrame, zw: float) -> pd.DataFrame:
    """Iterates through the SPT test depths and sequentially applies IS 2131 corrections."""
    results = spt_df.copy()
    results["σ'_v (kPa)"] = 0.0
    results["C_N"] = 1.0
    results["N_1 (Overburden)"] = 0.0
    results["Dilatancy Applied?"] = False
    results["N_final"] = 0.0
    
    for idx, row in results.iterrows():
        z_test = row["Test Depth (m)"]
        n_field = row["Field N-Value"]
        soil_type = str(row["Soil Symbol (IS 1498)"]).upper()
        
        sigma_v_prime = calculate_effective_overburden(z_test, zw, profile_df)
        results.at[idx, "σ'_v (kPa)"] = sigma_v_prime
        
        if any(cohesionless in soil_type for cohesionless in COHESIONLESS_SOILS):
            cn = get_overburden_factor(sigma_v_prime)
            results.at[idx, "C_N"] = cn
            n1 = n_field * cn
        else:
            results.at[idx, "C_N"] = 1.0
            n1 = n_field
            
        results.at[idx, "N_1 (Overburden)"] = n1
        
        is_fine_soil = any(fine in soil_type for fine in FINE_SANDS_SILTS)
        below_wt = z_test > zw
        
        if is_fine_soil and below_wt and n1 > 15:
            n_final = 15.0 + 0.5 * (n1 - 15.0)
            results.at[idx, "Dilatancy Applied?"] = True
        else:
            n_final = n1
            
        results.at[idx, "N_final"] = n_final

    return results


# ==============================================================================
# STREAMLIT USER INTERFACE (INTEGRATED TABS)
# ==============================================================================
def main():
    st.set_page_config(page_title="Geotechnical Platform CE 402", layout="wide")
    st.title("CE 402 Geotechnical Engineering Platform")
    
    # Create navigation tabs
    tab1, tab2 = st.tabs(["Module P1: Soil Profile", "Module P2: SPT Corrections"])
    
    # -------------------------------------------------------------------------
    # TAB 1: MODULE P1
    # -------------------------------------------------------------------------
    with tab1:
        st.header("Module P1: Stratigraphic Soil Profile & Water Table Definition")
        st.caption("Strict SI Unit Enforcement: Force = kN | Stress/Modulus = kPa | Depth/Thickness = m, mm | Unit Weight = kN/m³")

        st.sidebar.header("Groundwater Conditions")
        zw_measured_m = st.sidebar.number_input("Measured Water Table Depth (m)", min_value=0.0, max_value=100.0, value=3.50, step=0.10)
        zw_design_m = st.sidebar.number_input("Design Water Table Depth (m)", min_value=0.0, max_value=100.0, value=1.50, step=0.10)
        st.sidebar.info(f"Unit weight of water fixed at $\\gamma_w = {GAMMA_W_KN_M3}\\text{{ kN/m}}^3$")

        if "soil_profile_df" not in st.session_state:
            st.session_state.soil_profile_df = pd.DataFrame([
                {"Soil Type (USCS)": "Sand (SW/SP)", "z_top (m)": 0.0, "z_bot (m)": 3.0, "gamma_moist (kN/m³)": 18.0, "gamma_sat (kN/m³)": 20.0, "su (kPa)": 0.0, "c_prime (kPa)": 0.0, "phi_prime (deg)": 34.0, "E_prime (kPa)": 25000.0, "nu_prime (-)": 0.30, "e0 (-)": 0.65, "Cc (-)": 0.020, "Cr (-)": 0.005, "OCR (-)": 1.0, "cv (mm²/s)": 10.000},
                {"Soil Type (USCS)": "Clay (CL/CH)", "z_top (m)": 3.0, "z_bot (m)": 9.0, "gamma_moist (kN/m³)": 17.5, "gamma_sat (kN/m³)": 18.5, "su (kPa)": 45.0, "c_prime (kPa)": 5.0, "phi_prime (deg)": 24.0, "E_prime (kPa)": 8000.0, "nu_prime (-)": 0.35, "e0 (-)": 1.10, "Cc (-)": 0.350, "Cr (-)": 0.060, "OCR (-)": 1.5, "cv (mm²/s)": 0.045},
                {"Soil Type (USCS)": "Gravel (GW/GP)", "z_top (m)": 9.0, "z_bot (m)": 14.0, "gamma_moist (kN/m³)": 20.0, "gamma_sat (kN/m³)": 21.5, "su (kPa)": 0.0, "c_prime (kPa)": 0.0, "phi_prime (deg)": 38.0, "E_prime (kPa)": 60000.0, "nu_prime (-)": 0.25, "e0 (-)": 0.45, "Cc (-)": 0.010, "Cr (-)": 0.002, "OCR (-)": 1.0, "cv (mm²/s)": 50.000}
            ])

        st.subheader("1. Stratigraphic Layer Input Table")
        st.markdown("Add, delete, or modify soil layers below. Ensure depths are continuous from $z = 0.0\\text{ m}$.")

        edited_df = st.data_editor(
            st.session_state.soil_profile_df,
            num_rows="dynamic",
            use_container_width=True,
            column_config={
                "Soil Type (USCS)": st.column_config.SelectboxColumn("Soil Type (USCS)", options=list(SOIL_STYLES.keys()), required=True),
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

        processed_df, validation_errors = validate_and_process_profile(edited_df)

        if validation_errors:
            for err in validation_errors:
                st.error(err)
        else:
            # Save the valid processed profile back to session state so Module P2 can use it
            st.session_state.valid_profile = processed_df
            
            col_table, col_plot = st.columns([1.1, 1.2])
            with col_table:
                st.subheader("2. Derived Stiffness & Buoyant Parameters")
                st.dataframe(processed_df[["Soil Type (USCS)", "H (m)", "H (mm)", "gamma_sub (kN/m³)", "E_oed (kPa)", "mv (1/kPa)"]].style.format({"H (m)": "{:.2f}", "H (mm)": "{:,.0f}", "gamma_sub (kN/m³)": "{:.2f}", "E_oed (kPa)": "{:,.0f}", "mv (1/kPa)": "{:.2e}"}), use_container_width=True)
            with col_plot:
                st.subheader("3. Stratigraphic Profile Visualization")
                fig = plot_soil_profile(processed_df, zw_measured_m, zw_design_m)
                st.pyplot(fig)


    # -------------------------------------------------------------------------
    # TAB 2: MODULE P2
    # -------------------------------------------------------------------------
    with tab2:
        st.header("Module P2: SPT N-Value Corrections (IS 2131:1981)")
        st.caption("Automatically calculates effective overburden stress from the Module P1 soil profile.")
        
        col_p2_1, col_p2_2 = st.columns([1, 1])
        
        with col_p2_1:
            st.subheader("1. Active Stratigraphic Profile")
            if "valid_profile" in st.session_state:
                st.markdown("This profile is inherited from Tab 1 and will be used to integrate $\\sum (\\gamma \\cdot \\Delta z)$ downward to each test depth.")
                st.dataframe(st.session_state.valid_profile[["z_top (m)", "z_bot (m)", "gamma_moist (kN/m³)", "gamma_sat (kN/m³)"]], use_container_width=True)
            else:
                st.warning("Please define a valid soil profile in Tab 1 first.")
                
        with col_p2_2:
            st.subheader("2. Field SPT N-Values")
            st.markdown("Enter test depths, field N-values, and IS 1498 soil symbols (e.g., SM, SP, CI, GW).")
            
            if "spt_profile_df" not in st.session_state:
                st.session_state.spt_profile_df = pd.DataFrame([
                    {"Test Depth (m)": 1.5, "Field N-Value": 13, "Soil Symbol (IS 1498)": "SM"},
                    {"Test Depth (m)": 3.0, "Field N-Value": 16, "Soil Symbol (IS 1498)": "SM"},
                    {"Test Depth (m)": 4.5, "Field N-Value": 24, "Soil Symbol (IS 1498)": "SP"},
                    {"Test Depth (m)": 6.0, "Field N-Value": 6, "Soil Symbol (IS 1498)": "CI"},
                    {"Test Depth (m)": 12.0, "Field N-Value": 50, "Soil Symbol (IS 1498)": "GW"},
                ])

            spt_df = st.data_editor(
                st.session_state.spt_profile_df,
                num_rows="dynamic",
                use_container_width=True,
                column_config={
                    "Test Depth (m)": st.column_config.NumberColumn("Test Depth (m)", min_value=0.1, format="%.1f"),
                    "Field N-Value": st.column_config.NumberColumn("Field N-Value", min_value=1, step=1),
                    "Soil Symbol (IS 1498)": st.column_config.TextColumn("Soil Symbol (IS 1498)"),
                }
            )

        st.divider()

        if st.button("Calculate IS 2131:1981 Corrections", type="primary"):
            if "valid_profile" in st.session_state:
                spt_df = spt_df.sort_values(by="Test Depth (m)").reset_index(drop=True)
                st.session_state.spt_profile_df = spt_df
                
                # Execute correction using the active profile and the measured water table from sidebar
                corrected_df = apply_spt_corrections(spt_df, st.session_state.valid_profile, zw_measured_m)
                
                st.subheader("3. Corrected SPT Results & Intermediate Steps")
                st.dataframe(
                    corrected_df.style.format({
                        "Test Depth (m)": "{:.1f}", "Field N-Value": "{:.0f}", "σ'_v (kPa)": "{:.1f}", 
                        "C_N": "{:.2f}", "N_1 (Overburden)": "{:.1f}", "N_final": "{:.0f}"
                    }).map(lambda x: "background-color: #d4edda" if x else "", subset=["Dilatancy Applied?"]),
                    use_container_width=True
                )
            else:
                st.error("Cannot calculate. Please fix errors in Module P1 Soil Profile.")

if __name__ == "__main__":
    main()