import { getApp, shutdownApp } from './utils/testApp'
import { bodeguitaRestaurant } from './utils/testData'
import { getLoggedInCustomer, getLoggedInOwner } from './utils/auth'
import { createRestaurant } from './utils/restaurant'

import request from 'supertest'

// Test for restaurant promotion exam
describe('Promote restaurant', () => {
    let owner, customer, newRestaurant, app
    beforeAll(async () => {
      app = await getApp()
      owner = await getLoggedInOwner()
      customer = await getLoggedInCustomer()
      const validRestaurant = { ...bodeguitaRestaurant }
      validRestaurant.restaurantCategoryId = (await request(app).get('/restaurantCategories').send()).body[0].id
      newRestaurant = (await request(app).post('/restaurants').set('Authorization', `Bearer ${owner.token}`).send(validRestaurant)).body
    })
    it('Should return 401 if not logged in', async () => {
      const response = await request(app).patch(`/restaurants/${newRestaurant.id}/promote`).send()
      expect(response.status).toBe(401)
    })
    it('Should return 403 when logged in as a customer', async () => {
      const response = await request(app).patch(`/restaurants/${newRestaurant.id}/promote`).set('Authorization', `Bearer ${customer.token}`).send()
      expect(response.status).toBe(403)
    })
    it('Should return 403 when trying to promote a restaurant that is not yours', async () => {
      const restaurantNotOwned = await createRestaurant()
      const response = await request(app).patch(`/restaurants/${restaurantNotOwned.id}/promote`).set('Authorization', `Bearer ${owner.token}`).send()
      expect(response.status).toBe(403)
    })
    it('Should return 200 when successful promotion of restaurant', async () => {
      const response = await request(app).patch(`/restaurants/${newRestaurant.id}/promote`).set('Authorization', `Bearer ${owner.token}`).send()
      expect(response.status).toBe(200)
      // Check the promotion has actually updated the database
      const response2 = await request(app).get(`/restaurants/${newRestaurant.id}`).send()
      expect(response2.status).toBe(200)
      expect(response2.body.promoted).toBeDefined()
      expect(response2.body.promoted).toBe(true)
      // Must be the first one on listing
      const response3 = await request(app).get(`/users/myRestaurants`).set('Authorization', `Bearer ${owner.token}`).send()
      expect(response3.status).toBe(200)
      expect(response3.body[0].promoted).toBeDefined()
      expect(response3.body[0].promoted).toBe(true)
    })
    it('Should return 404 when trying to promote a restaurant already deleted', async () => {
      await request(app).delete(`/restaurants/${newRestaurant.id}`).set('Authorization', `Bearer ${owner.token}`).send()
      const response = await request(app).patch(`/restaurants/${newRestaurant.id}/promote`).set('Authorization', `Bearer ${owner.token}`).send()
      expect(response.status).toBe(404)
      expect(response.text).toBe('Not found')
    })
    it('Should return 200 and a promoted restaurant when trying to create a promoted restaurant and there is not any other promotion)', async () => {
      const validRestaurantToBePromoted = { ...bodeguitaRestaurant }
      validRestaurantToBePromoted.restaurantCategoryId = (await request(app).get('/restaurantCategories').send()).body[0].id
      validRestaurantToBePromoted.promoted = true
      const response = await request(app).post('/restaurants').set('Authorization', `Bearer ${owner.token}`).send(validRestaurantToBePromoted)
      const restaurantId=response.body.id
      expect(response.status).toBe(200)
      expect(response.body.promoted).toBeDefined()
      expect(response.body.promoted).toBe(true)
      // Must be the first one on listing
      const response2 = await request(app).get(`/users/myRestaurants`).set('Authorization', `Bearer ${owner.token}`).send()
      expect(response2.status).toBe(200)
      expect(response2.body[0].promoted).toBeDefined()
      expect(response2.body[0].promoted).toBe(true)
      // Delete the restaurant 
      await request(app).delete(`/restaurants/${restaurantId}`).set('Authorization', `Bearer ${owner.token}`).send()
    })
    it('Should return 422 when trying to create a promoted restaurant but there is already another promotion', async () => {
      const validRestaurantToBePromoted = { ...bodeguitaRestaurant }
      validRestaurantToBePromoted.restaurantCategoryId = (await request(app).get('/restaurantCategories').send()).body[0].id
      validRestaurantToBePromoted.promoted = true
      const firstResponse = await request(app).post('/restaurants').set('Authorization', `Bearer ${owner.token}`).send(validRestaurantToBePromoted)
      const restaurantId=firstResponse.body.id
      // The second restaurant
      const anotherValidRestaurantToBePromoted = { ...bodeguitaRestaurant }
      anotherValidRestaurantToBePromoted.restaurantCategoryId = (await request(app).get('/restaurantCategories').send()).body[0].id
      anotherValidRestaurantToBePromoted.promoted = true
      const secondResponse = await request(app).post('/restaurants').set('Authorization', `Bearer ${owner.token}`).send(anotherValidRestaurantToBePromoted)
      // Delete the first restaurant
      await request(app).delete(`/restaurants/${restaurantId}`).set('Authorization', `Bearer ${owner.token}`).send()
      expect(secondResponse.status).toBe(422)
    })
    afterAll(async () => {
      await shutdownApp()
    })
  })
  