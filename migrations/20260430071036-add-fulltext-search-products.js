"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE products
      ADD FULLTEXT INDEX ft_products_search (title, brand, description)
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE products
      DROP INDEX ft_products_search
    `);
  },
};