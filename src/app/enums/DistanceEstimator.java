package app.enums;

public enum DistanceEstimator {
    SPHERE("Sphere"),
    CUBE("Cube"),
    MENGER_SPONGE("Menger Sponge"),
    SIERPINKSI_TETRAHEDRON("Sierpinksi Tetrahedron"),
    MENGER_SIERPINSKI_SNOWFLAKE("Menger Snowflake"),
    MOSELY_SNOWFLAKE("Mosely Snowflake"),;

    private final String name;
    DistanceEstimator(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }
}
