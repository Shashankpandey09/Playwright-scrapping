module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js'],
    collectCoverageFrom: [
        'src/helpers/**/*.ts',
        '!src/helpers/index.ts'
    ]
};
